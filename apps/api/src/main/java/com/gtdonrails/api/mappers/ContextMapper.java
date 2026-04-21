package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.entities.Context;
import org.springframework.stereotype.Component;

@Component
public class ContextMapper {

    public ContextResponseDto toResponse(Context context) {
        return new ContextResponseDto(
            context.getId(),
            context.getName()
        );
    }
}
