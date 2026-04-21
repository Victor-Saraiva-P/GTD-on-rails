package com.gtdonrails.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gtdonrails.api.exceptions.api.GlobalExceptionHandler;
import com.gtdonrails.api.exceptions.inbox.InboxItemNotFoundException;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.exceptions.shared.ConflictException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.annotation.Validated;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

class ApiExceptionHandlerTests {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders
            .standaloneSetup(new TestExceptionController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .setValidator(validator)
            .build();
    }

    @Test
    void returnsStandardizedNotFoundProblemDetail() throws Exception {
        mockMvc.perform(get("/test-exceptions/not-found"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.status").value(404))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/resource-not-found"))
            .andExpect(jsonPath("$.title").value("Resource not found"))
            .andExpect(jsonPath("$.detail").value("item not found"))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/not-found"))
            .andExpect(jsonPath("$.path").value("/test-exceptions/not-found"))
            .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void returnsStandardizedConflictProblemDetail() throws Exception {
        mockMvc.perform(get("/test-exceptions/conflict"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/data-conflict"))
            .andExpect(jsonPath("$.detail").value("item already exists"))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/conflict"));
    }

    @Test
    void returnsStructuredValidationErrors() throws Exception {
        mockMvc.perform(post("/test-exceptions/validation")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name": "   "
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.title").value("Invalid data"))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-data"))
            .andExpect(jsonPath("$.detail").value(containsString("Field 'name': name is required")))
            .andExpect(jsonPath("$.detail").value(containsString("Field 'count': count is required")))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/validation"));
    }

    @Test
    void returnsBusinessProblemDetailForBusinessException() throws Exception {
        mockMvc.perform(get("/test-exceptions/business-error"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-operation"))
            .andExpect(jsonPath("$.detail").value("invalid business operation"))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/business-error"));
    }

    @Test
    void returnsInternalServerErrorForIllegalStateException() throws Exception {
        mockMvc.perform(get("/test-exceptions/illegal-state"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.status").value(500))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/system-error"))
            .andExpect(jsonPath("$.detail").value("bootstrap failed"))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/illegal-state"));
    }

    @Test
    void returnsGenericInternalServerErrorWithoutSensitiveDetails() throws Exception {
        mockMvc.perform(get("/test-exceptions/internal-error"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.status").value(500))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/system-error"))
            .andExpect(jsonPath("$.detail").value("System error, try again later"))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/internal-error"));
    }

    @Test
    void returnsBadRequestForTypeMismatch() throws Exception {
        mockMvc.perform(get("/test-exceptions/type-mismatch/not-a-uuid"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-parameter"))
            .andExpect(jsonPath("$.detail").value("The URL parameter 'id' received the value 'not-a-uuid', which has an invalid type. Correct it and try again."))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/type-mismatch/not-a-uuid"));
    }

    @Test
    void returnsBadRequestForMissingHeader() throws Exception {
        mockMvc.perform(get("/test-exceptions/missing-header"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-data"))
            .andExpect(jsonPath("$.detail").value("Required header is missing: X-Trace-Id"))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/missing-header"));
    }

    @Test
    void returnsBadRequestForMissingCookie() throws Exception {
        mockMvc.perform(get("/test-exceptions/missing-cookie"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-data"))
            .andExpect(jsonPath("$.detail").value("Required cookie is missing: auth"))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/missing-cookie"));
    }

    @Test
    void returnsBadRequestForMalformedJson() throws Exception {
        mockMvc.perform(post("/test-exceptions/validation")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-data"))
            .andExpect(jsonPath("$.detail").value("Request body is invalid"))
            .andExpect(jsonPath("$.instance").value("/test-exceptions/validation"));
    }

    @Validated
    @RestController
    static class TestExceptionController {

        @GetMapping("/test-exceptions/not-found")
        String notFound() {
            throw new InboxItemNotFoundException("item not found");
        }

        @GetMapping("/test-exceptions/conflict")
        String conflict() {
            throw new ConflictException("item already exists");
        }

        @GetMapping("/test-exceptions/business-error")
        String businessError() {
            throw new BusinessException("invalid business operation");
        }

        @GetMapping("/test-exceptions/illegal-state")
        String illegalState() {
            throw new IllegalStateException("bootstrap failed");
        }

        @GetMapping("/test-exceptions/internal-error")
        String internalError() {
            throw new RuntimeException("SQL syntax error with token=secret");
        }

        @GetMapping("/test-exceptions/type-mismatch/{id}")
        String typeMismatch(@PathVariable UUID id) {
            return id.toString();
        }

        @GetMapping("/test-exceptions/missing-header")
        String missingHeader(@RequestHeader("X-Trace-Id") String traceId) {
            return traceId;
        }

        @GetMapping("/test-exceptions/missing-cookie")
        String missingCookie(@CookieValue("auth") String authCookie) {
            return authCookie;
        }

        @PostMapping("/test-exceptions/validation")
        String validation(@Valid @RequestBody ValidationRequest request) {
            return request.name();
        }
    }

    record ValidationRequest(
        @NotBlank(message = "name is required")
        String name,

        @NotNull(message = "count is required")
        Integer count
    ) {
    }
}
