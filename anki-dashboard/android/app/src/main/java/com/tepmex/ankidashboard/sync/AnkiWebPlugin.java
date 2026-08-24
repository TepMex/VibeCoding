package com.tepmex.ankidashboard.sync;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "AnkiWeb")
public final class AnkiWebPlugin extends Plugin {
    private static final String DEFAULT_ENDPOINT = "https://sync.ankiweb.net/";
    private static final String PREFS = "anki_web";
    private static final String COLLECTION_DIR = "ankiweb";
    private static final String COLLECTION_NAME = "collection.anki2";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences preferences = preferences();
        File collection = collectionFile();
        JSObject result = new JSObject();
        result.put("hasCollection", collection.isFile());
        result.put("connected", !preferences.getString("hkey", "").isBlank());
        result.put("username", preferences.getString("username", ""));
        result.put("endpoint", preferences.getString("endpoint", DEFAULT_ENDPOINT));
        long syncedAt = preferences.getLong("syncedAt", 0);
        result.put("syncedAt", syncedAt == 0 ? JSONObject.NULL : syncedAt);
        if (collection.isFile()) result.put("collectionUri", Uri.fromFile(collection).toString());
        call.resolve(result);
    }

    @PluginMethod
    public void logout(PluginCall call) {
        preferences()
            .edit()
            .remove("hkey")
            .remove("syncedAt")
            .remove("serverMod")
            .apply();
        call.resolve();
    }

    @PluginMethod
    public void sync(PluginCall call) {
        String username = valueOrEmpty(call.getString("username")).trim();
        String password = valueOrEmpty(call.getString("password"));
        String endpoint = valueOrDefault(call.getString("endpoint"), DEFAULT_ENDPOINT).trim();
        if (username.isBlank()) {
            call.reject("AnkiWeb username is required");
            return;
        }

        executor.execute(() -> {
            try {
                JSObject result = performSync(username, password, endpoint);
                call.resolve(result);
            } catch (Exception exception) {
                String message = exception.getMessage();
                call.reject(message == null ? "AnkiWeb sync failed" : message, exception);
            }
        });
    }

    private JSObject performSync(String username, String password, String endpoint) throws IOException {
        SharedPreferences saved = preferences();
        String savedHkey = saved.getString("hkey", "");
        String savedUsername = saved.getString("username", "");
        String savedEndpoint = saved.getString("endpoint", DEFAULT_ENDPOINT);
        boolean explicitLogin = !password.isBlank();
        boolean canReuse =
            !explicitLogin
                && !savedHkey.isBlank()
                && username.equals(savedUsername)
                && SyncHttpClient.endpointsEquivalent(savedEndpoint, endpoint);

        SyncHttpClient client = new SyncHttpClient(
            canReuse ? savedEndpoint : endpoint,
            canReuse ? savedHkey : ""
        );

        if (explicitLogin) {
            emitProgress("login", 0, null);
            client.resetToDefaultEntryHost();
            client.login(username, password);
            int attempts = 0;
            while (client.hostChangedOnLastRequest() && attempts < 3) {
                client.login(username, password);
                attempts += 1;
            }
        } else if (!canReuse) {
            throw new SyncException(
                "Password required: there is no reusable session for this account",
                "login",
                "hostKey",
                endpoint,
                null,
                null,
                null,
                null
            );
        }

        emitProgress("meta", 0, null);
        JSONObject serverMeta = null;
        try {
            serverMeta = client.meta();
        } catch (IOException exception) {
            if (!client.hasResolvedShard()) throw exception;
        }

        if (explicitLogin && client.hasResolvedShard()) {
            client.login(username, password);
        }

        emitProgress("download", 0, null);
        byte[] collection = client.download((received, total) ->
            emitProgress("download", received, total)
        );
        validateCollection(collection);

        emitProgress("saving", collection.length, (long) collection.length);
        saveCollection(collection);
        long syncedAt = System.currentTimeMillis();
        String resolvedEndpoint = client.getSyncHost() == null
            ? client.getBaseUrl()
            : "https://" + client.getSyncHost() + "/";

        SharedPreferences.Editor editor = saved
            .edit()
            .putString("hkey", client.getHkey())
            .putString("username", username)
            .putString("endpoint", resolvedEndpoint)
            .putLong("syncedAt", syncedAt);
        if (serverMeta != null && serverMeta.has("mod")) {
            editor.putLong("serverMod", serverMeta.optLong("mod"));
        } else {
            editor.remove("serverMod");
        }
        editor.apply();

        JSObject result = new JSObject();
        result.put("collectionUri", Uri.fromFile(collectionFile()).toString());
        result.put("byteLength", collection.length);
        result.put("syncedAt", syncedAt);
        if (serverMeta != null && serverMeta.has("mod")) {
            result.put("serverMod", serverMeta.optLong("mod"));
        }
        return result;
    }

    private void emitProgress(String phase, long received, Long total) {
        JSObject event = new JSObject();
        event.put("phase", phase);
        event.put("received", received);
        if (total != null) event.put("total", total);
        notifyListeners("syncProgress", event);
    }

    private void validateCollection(byte[] data) throws IOException {
        if (data.length < 16) throw new IOException("Downloaded collection is empty");
        String signature = new String(data, 0, 16, java.nio.charset.StandardCharsets.US_ASCII);
        if (!signature.startsWith("SQLite format 3")) {
            throw new IOException("Downloaded data is not a collection.anki2 SQLite database");
        }
    }

    private void saveCollection(byte[] data) throws IOException {
        File destination = collectionFile();
        File directory = destination.getParentFile();
        if (directory == null || (!directory.isDirectory() && !directory.mkdirs())) {
            throw new IOException("Cannot create local collection storage");
        }
        File temporary = new File(directory, COLLECTION_NAME + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temporary)) {
            output.write(data);
            output.getFD().sync();
        }
        if (destination.exists() && !destination.delete()) {
            temporary.delete();
            throw new IOException("Cannot replace the previous collection");
        }
        if (!temporary.renameTo(destination)) {
            temporary.delete();
            throw new IOException("Cannot install the downloaded collection");
        }
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private File collectionFile() {
        return new File(new File(getContext().getFilesDir(), COLLECTION_DIR), COLLECTION_NAME);
    }

    private static String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
