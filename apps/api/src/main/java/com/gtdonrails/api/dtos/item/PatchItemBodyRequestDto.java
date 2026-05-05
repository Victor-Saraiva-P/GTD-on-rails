package com.gtdonrails.api.dtos.item;

import com.gtdonrails.api.types.ItemBody;
import jakarta.validation.Valid;

public record PatchItemBodyRequestDto(
    @Valid
    ItemBody body
) {
}
