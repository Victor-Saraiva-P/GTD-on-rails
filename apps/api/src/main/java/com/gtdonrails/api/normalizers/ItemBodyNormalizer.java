package com.gtdonrails.api.normalizers;

import java.util.List;
import java.util.Set;

import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.BlockEntityAttrs;
import com.gtdonrails.api.types.InlineMark;
import com.gtdonrails.api.types.InlineMarkAttrs;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.LineBlock;
import com.gtdonrails.api.types.LineBlockAttrs;
import org.springframework.stereotype.Component;

@Component
public class ItemBodyNormalizer {

    public static final int MAX_BODY_LENGTH = 100_000;
    private static final Set<String> INLINE_TYPES = Set.of("bold", "italic", "inlineCode", "link", "highlight", "textColor", "backgroundColor");
    private static final Set<String> LINE_TYPES = Set.of("paragraph", "heading1", "heading2", "heading3", "bullet", "numbered", "lettered", "quote", "checklist", "divider");
    private static final Set<String> ENTITY_TYPES = Set.of("image", "pdf", "docx", "xlsx", "file");

    public ItemBody normalizeBody(ItemBody value) {
        return normalizeBodyValue(value);
    }

    public static ItemBody normalizeBodyValue(ItemBody value) {
        String text = normalizedText(value == null ? null : value.text());
        return new ItemBody(
            text,
            normalizedInlineMarks(value, text.length()),
            normalizedLineBlocks(value, text.length()),
            normalizedBlockEntities(value, text.length()));
    }

    private static String normalizedText(String value) {
        String normalized = value == null ? "" : value.replace("\r\n", "\n").replace('\r', '\n');
        validatePlainText(normalized);
        validateBodyLength(normalized);
        return normalized;
    }

    private static List<InlineMark> normalizedInlineMarks(ItemBody body, int max) {
        if (body == null || body.inlineMarks() == null) {
            return List.of();
        }
        return body.inlineMarks().stream().map(mark -> normalizeInlineMark(mark, max)).flatMap(List::stream).toList();
    }

    private static List<InlineMark> normalizeInlineMark(InlineMark mark, int max) {
        if (mark == null || !INLINE_TYPES.contains(mark.type()) || mark.from() > mark.to()) {
            return List.of();
        }
        int from = clamp(mark.from(), max);
        int to = clamp(mark.to(), max);
        if (from >= to) {
            return List.of();
        }
        return List.of(new InlineMark(mark.id(), mark.type(), from, to, normalizeAttrs(mark.attrs())));
    }

    private static List<LineBlock> normalizedLineBlocks(ItemBody body, int max) {
        if (body == null || body.lineBlocks() == null) {
            return List.of();
        }
        return body.lineBlocks().stream().map(block -> normalizeLineBlock(block, max)).flatMap(List::stream).toList();
    }

    private static List<LineBlock> normalizeLineBlock(LineBlock block, int max) {
        if (block == null || !LINE_TYPES.contains(block.type()) || block.from() > block.to()) {
            return List.of();
        }
        return List.of(new LineBlock(block.id(), block.type(), clamp(block.from(), max), clamp(block.to(), max), normalizeAttrs(block.attrs())));
    }

    private static List<BlockEntity> normalizedBlockEntities(ItemBody body, int max) {
        if (body == null || body.blockEntities() == null) {
            return List.of();
        }
        return body.blockEntities().stream().map(entity -> normalizeBlockEntity(entity, max)).flatMap(List::stream).toList();
    }

    private static List<BlockEntity> normalizeBlockEntity(BlockEntity entity, int max) {
        if (entity == null || !ENTITY_TYPES.contains(entity.type()) || entity.from() > entity.to()) {
            return List.of();
        }
        return List.of(new BlockEntity(entity.id(), entity.type(), clamp(entity.from(), max), clamp(entity.to(), max), entity.assetId(), normalizeAttrs(entity.attrs())));
    }

    private static InlineMarkAttrs normalizeAttrs(InlineMarkAttrs attrs) {
        return attrs == null ? null : new InlineMarkAttrs(attrs.href(), attrs.color());
    }

    private static LineBlockAttrs normalizeAttrs(LineBlockAttrs attrs) {
        return attrs == null ? null : new LineBlockAttrs(attrs.checked());
    }

    private static BlockEntityAttrs normalizeAttrs(BlockEntityAttrs attrs) {
        return attrs == null ? null : new BlockEntityAttrs(attrs.displayName(), attrs.contentType(), attrs.url(), attrs.localPath());
    }

    private static int clamp(int value, int max) {
        return Math.max(0, Math.min(value, max));
    }

    private static void validateBodyLength(String value) {
        if (value.length() > MAX_BODY_LENGTH) {
            throw new IllegalArgumentException("body.text length '" + value.length() + "' is invalid; expected at most " + MAX_BODY_LENGTH + " characters");
        }
    }

    private static void validatePlainText(String value) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (Character.isISOControl(character) && character != '\n' && character != '\t') {
                throw new IllegalArgumentException("body.text character U+" + String.format("%04X", (int) character) + " is invalid; expected printable text");
            }
        }
    }
}
