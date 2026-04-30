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

public record UpdateItemRequestDto(
    @NotBlank(message = "title is required")
    @Size(max = Title.MAX_LENGTH, message = "title exceeds max length of " + Title.MAX_LENGTH)
    String title,

    Body body,

    @DecimalMin(
        value = Item.MIN_ENERGY_VALUE,
        inclusive = true,
        message = "energy must be between " + Item.MIN_ENERGY_VALUE + " and " + Item.MAX_ENERGY_VALUE)
    @DecimalMax(
        value = Item.MAX_ENERGY_VALUE,
        inclusive = true,
        message = "energy must be between " + Item.MIN_ENERGY_VALUE + " and " + Item.MAX_ENERGY_VALUE)
    @Digits(integer = 2, fraction = Item.ENERGY_SCALE, message = "energy must have up to 1 decimal place")
    BigDecimal energy,

    @Valid
    ItemTimeRequestDto time,

    @Size(
        max = Context.MAX_CONTEXTS_PER_ITEM,
        message = "contextIds exceeds max size of " + Context.MAX_CONTEXTS_PER_ITEM)
    List<UUID> contextIds
) {
}
