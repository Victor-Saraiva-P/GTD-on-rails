package com.gtdonrails.syncserver;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/mobile-api")
public class MobileController {

    private final MobileService mobileService;

    public MobileController(MobileService mobileService) {
        this.mobileService = mobileService;
    }

    /**
     * Returns the mobile read model in one request.
     *
     * <p>Example: {@code GET /mobile-api/bootstrap}.</p>
     */
    @GetMapping("/bootstrap")
    public MobileBootstrap bootstrap() {
        return mobileService.bootstrap();
    }

    /**
     * Captures new GTD stuff from the mobile quick-capture screen.
     *
     * <p>Example: {@code POST /mobile-api/inbox}.</p>
     */
    @PostMapping("/inbox")
    @ResponseStatus(HttpStatus.CREATED)
    public MobileCaptureResponse capture(@RequestBody MobileCaptureRequest request) {
        return mobileService.capture(request);
    }
}
