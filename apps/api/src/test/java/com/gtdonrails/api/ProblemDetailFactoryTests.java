package com.gtdonrails.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

@Tag("unit")
class ProblemDetailFactoryTests {

    private final ProblemDetailFactory problemDetailFactory =
        new ProblemDetailFactory("https://gtdonrails.test", "/api-errors");

    @Test
    void createsProblemDetailWithRequestMetadata() {
        ProblemDetail problemDetail = problemDetailFactory.create(
            HttpStatus.BAD_REQUEST,
            "Invalid data",
            "/invalid-data",
            "Field is invalid",
            requestFor("/items"));

        assertEquals("Invalid data", problemDetail.getTitle());
        assertEquals("Field is invalid", problemDetail.getDetail());
        assertEquals("https://gtdonrails.test/api-errors/invalid-data", problemDetail.getType().toString());
        assertEquals("/items", problemDetail.getInstance().toString());
        assertEquals("/items", problemDetail.getProperties().get("path"));
        assertNotNull(problemDetail.getProperties().get("timestamp"));
    }

    @Test
    void createsDefaultNotFoundProblemFromRequestPath() {
        ProblemDetail problemDetail = problemDetailFactory.createDefault(
            HttpStatus.NOT_FOUND,
            null,
            requestFor("/missing"));

        assertEquals("Invalid URI", problemDetail.getTitle());
        assertEquals("https://gtdonrails.test/api-errors/invalid-uri", problemDetail.getType().toString());
        assertEquals("The requested URI '/missing' does not exist. Correct it and try again.",
            problemDetail.getDetail());
    }

    @Test
    void createsDefaultSystemProblemFromStringBody() {
        ProblemDetail problemDetail = problemDetailFactory.createDefault(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Custom failure",
            requestFor("/items"));

        assertEquals("System error", problemDetail.getTitle());
        assertEquals("Custom failure", problemDetail.getDetail());
        assertEquals("https://gtdonrails.test/api-errors/system-error", problemDetail.getType().toString());
    }

    private ServletWebRequest requestFor(String requestUri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(requestUri);
        return new ServletWebRequest(request);
    }
}
