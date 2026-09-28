package com.gtdonrails.syncserver;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SyncFileConflictHttpTests {

    @Test
    void missingFileReadReturnsNotFoundStatus() throws Exception {
        MockMvc mvc = mvcWithMissingFileService();

        mvc.perform(missingFileRead())
            .andExpect(status().isNotFound());
    }

    @Test
    void fileRevisionConflictReturnsConflictStatusAndCurrentRevision() throws Exception {
        MockMvc mvc = mvcWithConflictingFileService();

        mvc.perform(staleFileMutation())
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.currentRevision").value(1))
            .andExpect(jsonPath("$.message").value(containsString("stale")));
    }

    private MockMvc mvcWithConflictingFileService() {
        SyncFileService files = mock(SyncFileService.class);
        when(files.apply(any(), any())).thenThrow(new SyncConflictException("body_document", "item-1", 0L, 1L));
        return MockMvcBuilders.standaloneSetup(new SyncFileController(files))
            .setControllerAdvice(new SyncServerExceptionHandler())
            .build();
    }

    private MockMvc mvcWithMissingFileService() {
        SyncFileService files = mock(SyncFileService.class);
        when(files.read("body_document", "item-1"))
            .thenThrow(new SyncObjectNotFoundException("body_document", "item-1"));
        return MockMvcBuilders.standaloneSetup(new SyncFileController(files))
            .setControllerAdvice(new SyncServerExceptionHandler())
            .build();
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder missingFileRead() {
        return get("/v1/files")
            .header("X-Object-Type", "body_document")
            .header("X-Object-Id", "item-1");
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder staleFileMutation() {
        return post("/v1/files")
            .header("X-Operation-Id", UUID.randomUUID())
            .header("X-Object-Type", "body_document")
            .header("X-Object-Id", "item-1")
            .header("X-Base-Revision", "0")
            .header("X-Relative-Path", "items/item-1/body.md")
            .contentType(MediaType.TEXT_MARKDOWN)
            .content(new byte[0]);
    }
}
