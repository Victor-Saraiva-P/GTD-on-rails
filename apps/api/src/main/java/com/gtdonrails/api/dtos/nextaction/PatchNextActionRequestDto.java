package com.gtdonrails.api.dtos.nextaction;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.ItemTimeRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.NextAction;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;

public record PatchNextActionRequestDto(
    @DecimalMin(
        value = NextAction.MIN_ENERGY_VALUE,
        inclusive = true,
        message = "expected between " + NextAction.MIN_ENERGY_VALUE + " and " + NextAction.MAX_ENERGY_VALUE)
    @DecimalMax(
        value = NextAction.MAX_ENERGY_VALUE,
        inclusive = true,
        message = "expected between " + NextAction.MIN_ENERGY_VALUE + " and " + NextAction.MAX_ENERGY_VALUE)
    @Digits(integer = 2, fraction = NextAction.ENERGY_SCALE, message = "expected up to 1 decimal place")
    BigDecimal energy,

    @Valid
    ItemTimeRequestDto estimatedTime,

    @Size(
        max = Context.MAX_CONTEXTS_PER_ITEM,
        message = "expected at most " + Context.MAX_CONTEXTS_PER_ITEM + " context IDs")
    List<UUID> contextIds
) {
}
