package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class GoogleCalendarCallbackAccessFilterTests {

    private final GoogleCalendarCallbackAccessFilter filter = new GoogleCalendarCallbackAccessFilter(7676);

    @Test
    void callbackConnectorAllowsOnlyTheOAuthCallback() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = filterRequest(7676, "GET", "/oauth/google/callback", chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void callbackConnectorRejectsOtherPathsAndMethods() throws Exception {
        assertRejected(7676, "GET", "/v1/integrations/google-calendar/status");
        assertRejected(7676, "POST", "/oauth/google/callback");
    }

    @Test
    void normalSyncConnectorDoesNotUseCallbackRestrictions() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = filterRequest(9475, "GET", "/health", chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    private void assertRejected(int port, String method, String path) throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = filterRequest(port, method, path, chain);

        assertEquals(404, response.getStatus());
        assertNull(chain.getRequest());
    }

    private MockHttpServletResponse filterRequest(int port, String method, String path, FilterChain chain) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setLocalPort(port);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }
}
