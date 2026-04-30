package com.gtdonrails.api.dtos.item;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;

public record CreateItemRequestDto(
    @NotBlank(message = "expected non-blank text")
    @Size(max = Title.MAX_LENGTH, message = "expected at most " + Title.MAX_LENGTH + " characters")
    String title,

    Body body,

    @DecimalMin(
        value = Item.MIN_ENERGY_VALUE,
        inclusive = true,
        message = "expected between " + Item.MIN_ENERGY_VALUE + " and " + Item.MAX_ENERGY_VALUE)
    @DecimalMax(
        value = Item.MAX_ENERGY_VALUE,
        inclusive = true,
        message = "expected between " + Item.MIN_ENERGY_VALUE + " and " + Item.MAX_ENERGY_VALUE)
    @Digits(integer = 2, fraction = Item.ENERGY_SCALE, message = "expected up to 1 decimal place")
    BigDecimal energy,

    @Valid
    ItemTimeRequestDto time,

    @Size(
        max = Context.MAX_CONTEXTS_PER_ITEM,
        message = "expected at most " + Context.MAX_CONTEXTS_PER_ITEM + " context IDs")
    List<UUID> contextIds
) {
}
