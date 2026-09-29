package com.gtdonrails.syncserver;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MobilePageController {

    /**
     * Opens the installed mobile shell at a stable directory URL.
     *
     * <p>Example: {@code GET /mobile/}.</p>
     */
    @GetMapping({"/mobile", "/mobile/"})
    public String mobile() {
        return "forward:/mobile/index.html";
    }
}
