package com.tepmex.ankidashboard.sync;

import java.io.IOException;

public final class SyncException extends IOException {
    public final String phase;
    public final String method;
    public final String url;
    public final Integer httpStatus;
    public final String responseSnippet;
    public final String syncHost;

    public SyncException(
        String message,
        String phase,
        String method,
        String url,
        Integer httpStatus,
        String responseSnippet,
        String syncHost,
        Throwable cause
    ) {
        super(message, cause);
        this.phase = phase;
        this.method = method;
        this.url = url;
        this.httpStatus = httpStatus;
        this.responseSnippet = responseSnippet;
        this.syncHost = syncHost;
    }
}
