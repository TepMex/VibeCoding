package com.tepmex.ankidashboard.sync;

import com.github.luben.zstd.Zstd;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Download-only AnkiWeb sync v11 transport. This is a Java port of the proven
 * CloudAgenticCoding/anki-dashboard-apk client, including shard redirects.
 */
public final class SyncHttpClient {
    public interface ProgressCallback {
        void onProgress(long received, Long total);
    }

    private static final int SYNC_VERSION = 11;
    private static final String CLIENT_VERSION = "anki-dashboard/2.0";
    private static final String DEFAULT_ENDPOINT = "https://sync.ankiweb.net/";
    private static final int MAX_REDIRECT_HOPS = 5;
    private static final MediaType OCTET_STREAM = MediaType.get("application/octet-stream");
    private static final char[] SESSION_CHARS =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray();

    private final OkHttpClient http;
    private final String sessionKey = generateSessionKey();
    private String baseUrl;
    private String syncHost;
    private String hkey;
    private boolean hostChangedOnLastRequest;

    public SyncHttpClient(String endpoint, String hkey) throws IOException {
        this.baseUrl = normalizeEndpoint(endpoint);
        this.syncHost = numberedHost(this.baseUrl);
        this.hkey = hkey == null ? "" : hkey;
        this.http = new OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .followRedirects(false)
            .build();
    }

    public String login(String username, String password) throws IOException {
        JSONObject body = jsonObject("u", username, "p", password);
        String text = new String(
            post("hostKey", "login", body, false, null),
            StandardCharsets.UTF_8
        );
        try {
            JSONObject response = new JSONObject(text);
            String key = response.optString("key", "");
            if (key.isBlank()) {
                throw error("login", "hostKey", "Login failed: no host key returned", null, text, null);
            }
            hkey = key;
            return key;
        } catch (JSONException exception) {
            throw error(
                "login",
                "hostKey",
                "Login response was not valid JSON",
                null,
                text,
                exception
            );
        }
    }

    public JSONObject meta() throws IOException {
        if (hkey.isBlank()) {
            throw error("meta", "meta", "Missing AnkiWeb session", null, null, null);
        }
        JSONObject body = jsonObject("v", SYNC_VERSION, "cv", CLIENT_VERSION);
        String text = new String(post("meta", "meta", body, false, null), StandardCharsets.UTF_8);
        try {
            JSONObject result = new JSONObject(text);
            int hostNumber = result.optInt("hostNum", 0);
            if (hostNumber > 0) applyResolvedHost("sync" + hostNumber + ".ankiweb.net");
            return result;
        } catch (JSONException exception) {
            throw error("meta", "meta", "Server metadata was not valid JSON", null, text, exception);
        }
    }

    public byte[] download(ProgressCallback callback) throws IOException {
        return post("download", "download", new JSONObject(), true, callback);
    }

    private byte[] post(
        String method,
        String phase,
        JSONObject body,
        boolean useSession,
        ProgressCallback callback
    ) throws IOException {
        byte[] compressedRequest = Zstd.compress(body.toString().getBytes(StandardCharsets.UTF_8));
        int redirects = 0;
        boolean retriedResolvedHost = false;

        while (true) {
            hostChangedOnLastRequest = false;
            String requestUrl = baseUrl + "sync/" + method;
            JSONObject syncHeader = jsonObject(
                "v",
                SYNC_VERSION,
                "k",
                hkey,
                "s",
                useSession ? sessionKey : "",
                "c",
                CLIENT_VERSION
            );

            Request request = new Request.Builder()
                .url(requestUrl)
                .post(RequestBody.create(compressedRequest, OCTET_STREAM))
                .header("Content-Type", "application/octet-stream")
                .header("anki-sync", syncHeader.toString())
                .header("Accept-Encoding", "identity")
                .build();

            try (Response response = http.newCall(request).execute()) {
                if (response.code() == 308 && redirects < MAX_REDIRECT_HOPS) {
                    String location = response.header("Location");
                    if (location != null && !location.isBlank()) {
                        applyRedirect(requestUrl, location);
                        redirects += 1;
                        continue;
                    }
                }

                String previousHost = syncHost;
                String resolvedHost = response.header("x-resolved-sync-host");
                if (isNumberedSyncHost(resolvedHost)) applyResolvedHost(resolvedHost);

                if (
                    !response.isSuccessful()
                        && isNumberedSyncHost(resolvedHost)
                        && !resolvedHost.equals(previousHost)
                        && !retriedResolvedHost
                ) {
                    retriedResolvedHost = true;
                    continue;
                }

                ResponseBody responseBody = response.body();
                if (!response.isSuccessful()) {
                    String details = responseBody == null ? "" : responseBody.string();
                    String message = "Sync " + method + " failed (HTTP " + response.code() + ")";
                    if (response.code() == 400 && hkey.isBlank()) {
                        message += ": sign in again";
                    }
                    throw error(
                        phase,
                        method,
                        message,
                        response.code(),
                        truncate(details, 1000),
                        null
                    );
                }
                if (responseBody == null) {
                    throw error(phase, method, "Sync response has no body", null, null, null);
                }

                byte[] compressed = readBody(responseBody, callback);
                long originalSize = parseLong(response.header("anki-original-size"));
                long decompressedSize = originalSize > 0
                    ? originalSize
                    : Zstd.getFrameContentSize(compressed);
                if (decompressedSize <= 0 || decompressedSize > Integer.MAX_VALUE) {
                    throw error(
                        phase,
                        method,
                        "Invalid decompressed response size",
                        null,
                        null,
                        null
                    );
                }
                byte[] decompressed = Zstd.decompress(compressed, (int) decompressedSize);
                if (Zstd.isError(decompressed.length)) {
                    throw error(
                        phase,
                        method,
                        "Failed to decompress sync response",
                        null,
                        null,
                        null
                    );
                }
                return decompressed;
            } catch (SyncException exception) {
                throw exception;
            } catch (IOException exception) {
                throw error(
                    phase,
                    method,
                    exception.getMessage() == null ? "Network error during sync" : exception.getMessage(),
                    null,
                    null,
                    exception
                );
            }
        }
    }

    private static byte[] readBody(ResponseBody body, ProgressCallback callback) throws IOException {
        long contentLength = body.contentLength();
        Long total = contentLength > 0 ? contentLength : null;
        try (
            InputStream input = body.byteStream();
            ByteArrayOutputStream output = new ByteArrayOutputStream(
                contentLength > 0 && contentLength < Integer.MAX_VALUE ? (int) contentLength : 32_768
            )
        ) {
            byte[] chunk = new byte[32_768];
            long received = 0;
            int read;
            while ((read = input.read(chunk)) != -1) {
                output.write(chunk, 0, read);
                received += read;
                if (callback != null) callback.onProgress(received, total);
            }
            return output.toByteArray();
        }
    }

    public void resetToDefaultEntryHost() throws IOException {
        baseUrl = normalizeEndpoint(DEFAULT_ENDPOINT);
        syncHost = null;
        hostChangedOnLastRequest = false;
    }

    private void applyResolvedHost(String hostname) throws IOException {
        validateAnkiWebHost(hostname);
        String previous = syncHost;
        syncHost = hostname.toLowerCase(Locale.ROOT);
        baseUrl = "https://" + syncHost + "/";
        if (!syncHost.equals(previous)) hostChangedOnLastRequest = true;
    }

    private void applyRedirect(String requestUrl, String location) throws IOException {
        try {
            URI redirect = new URI(requestUrl).resolve(location);
            applyResolvedHost(redirect.getHost());
        } catch (URISyntaxException exception) {
            throw new IOException("Invalid AnkiWeb redirect", exception);
        }
    }

    private SyncException error(
        String phase,
        String method,
        String message,
        Integer status,
        String snippet,
        Throwable cause
    ) {
        return new SyncException(
            message,
            phase,
            method,
            baseUrl + "sync/" + method,
            status,
            snippet,
            syncHost,
            cause
        );
    }

    public boolean hasResolvedShard() {
        return isNumberedSyncHost(syncHost);
    }

    public boolean hostChangedOnLastRequest() {
        return hostChangedOnLastRequest;
    }

    public String getHkey() {
        return hkey;
    }

    public void setHkey(String value) {
        hkey = value == null ? "" : value;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public String getSyncHost() {
        return syncHost;
    }

    public static boolean endpointsEquivalent(String saved, String requested) {
        try {
            String a = normalizeEndpoint(saved);
            String b = normalizeEndpoint(requested);
            if (a.equals(b)) return true;
            String defaultUrl = normalizeEndpoint(DEFAULT_ENDPOINT);
            return (numberedHost(a) != null && b.equals(defaultUrl))
                || (numberedHost(b) != null && a.equals(defaultUrl));
        } catch (IOException exception) {
            return false;
        }
    }

    private static String normalizeEndpoint(String endpoint) throws IOException {
        String candidate = endpoint == null || endpoint.isBlank() ? DEFAULT_ENDPOINT : endpoint.trim();
        try {
            URI uri = new URI(candidate);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IOException("AnkiWeb endpoint must use HTTPS");
            }
            validateAnkiWebHost(uri.getHost());
            return "https://" + uri.getHost().toLowerCase(Locale.ROOT) + "/";
        } catch (URISyntaxException exception) {
            throw new IOException("Invalid AnkiWeb endpoint", exception);
        }
    }

    private static String numberedHost(String endpoint) {
        try {
            String host = new URI(endpoint).getHost();
            return isNumberedSyncHost(host) ? host : null;
        } catch (URISyntaxException exception) {
            return null;
        }
    }

    private static boolean isNumberedSyncHost(String host) {
        return host != null && host.toLowerCase(Locale.ROOT).matches("^sync\\d+\\.ankiweb\\.net$");
    }

    private static void validateAnkiWebHost(String host) throws IOException {
        String normalized = host == null ? "" : host.toLowerCase(Locale.ROOT);
        if (!normalized.equals("sync.ankiweb.net") && !isNumberedSyncHost(normalized)) {
            throw new IOException("Only official AnkiWeb sync endpoints are allowed");
        }
    }

    private static String generateSessionKey() {
        SecureRandom random = new SecureRandom();
        StringBuilder result = new StringBuilder(20);
        for (int index = 0; index < 20; index += 1) {
            result.append(SESSION_CHARS[random.nextInt(SESSION_CHARS.length)]);
        }
        return result.toString();
    }

    private static long parseLong(String value) {
        if (value == null) return 0;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static JSONObject jsonObject(Object... pairs) throws IOException {
        JSONObject result = new JSONObject();
        try {
            for (int index = 0; index < pairs.length; index += 2) {
                result.put(String.valueOf(pairs[index]), pairs[index + 1]);
            }
            return result;
        } catch (JSONException exception) {
            throw new IOException("Cannot encode AnkiWeb sync request", exception);
        }
    }
}
