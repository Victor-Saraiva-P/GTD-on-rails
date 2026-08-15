package com.gtdonrails.api.services;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.ContextRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class ContextIconAssetServiceTests {

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private ContextIconAssetRepository contextIconAssetRepository;

    @Mock
    private AssetStorageService assetStorageService;

    @Mock
    private FileSyncService fileSyncService;

    @Mock
    private ContextMapper contextMapper;

    private ContextIconAssetService contextIconAssetService;

    @BeforeEach
    void setUp() {
        contextIconAssetService = new ContextIconAssetService(
            contextRepository,
            contextIconAssetRepository,
            assetStorageService,
            fileSyncService,
            new AfterCommitExecutor(),
            contextMapper);
    }

    @Test
    void updatesAnIconWithOneFileSyncRequest() {
        Context context = contextWithNoIcon();
        MockMultipartFile file = imageFile();

        contextIconAssetService.updateContextIcon(context.getId(), file);

        verify(fileSyncService, times(1)).requestSyncAfterCommit(any(AfterCommitExecutor.class), eq("context icon updated"));
    }

    @Test
    void deletesAnIconWithOneFileSyncRequest() {
        Context context = contextWithNoIcon();

        contextIconAssetService.deleteContextIcon(context.getId());

        verify(fileSyncService, times(1)).requestSyncAfterCommit(any(AfterCommitExecutor.class), eq("context icon deleted"));
    }

    private Context contextWithNoIcon() {
        Context context = new Context("home");
        UUID contextId = context.getId();
        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(contextIconAssetRepository.findByContextIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.empty());
        return context;
    }

    private MockMultipartFile imageFile() {
        MockMultipartFile file = new MockMultipartFile("file", "home.png", "image/png", new byte[10]);
        when(assetStorageService.imageAssetFileName(file)).thenReturn("home.png");
        return file;
    }
}
