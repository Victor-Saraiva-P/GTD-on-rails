package com.gtdonrails.api.bodydocuments;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.InlineMark;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.LineBlock;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ItemBodyMarkdownCodec {

    /**
     * Materializes the legacy structured body representation as plain Markdown.
     *
     * <p>Example: {@code codec.toMarkdown(item.getBody())}.</p>
     */
    public String toMarkdown(ItemBody body) {
        ItemBody normalized = ItemBodyNormalizer.normalizeBodyValue(body);
        String formatted = formatLines(normalized.text(), normalized.inlineMarks(), normalized.lineBlocks());
        return replaceAssetTokens(formatted, normalized.blockEntities());
    }

    private String formatLines(String text, List<InlineMark> marks, List<LineBlock> blocks) {
        if (text.isEmpty()) return "";
        List<LineSlice> lines = lineSlices(text);
        List<String> rendered = new ArrayList<>(lines.size());
        for (LineSlice line : lines) {
            rendered.add(renderLine(text, line, marks, blocks));
        }
        return String.join("\n", rendered);
    }

    private String renderLine(String text, LineSlice line, List<InlineMark> marks, List<LineBlock> blocks) {
        String value = text.substring(line.start(), line.end());
        LineBlock block = matchingBlock(line, blocks);
        if (block != null && "divider".equals(block.type())) return "---";
        String formatted = applyInlineMarks(value, line.start(), marks);
        return blockPrefix(block, formatted) + formatted;
    }

    private String blockPrefix(LineBlock block, String line) {
        if (block == null || alreadyHasBlockMarker(block, line)) return "";
        return switch (block.type()) {
            case "heading1" -> "# ";
            case "heading2" -> "## ";
            case "heading3" -> "### ";
            case "bullet" -> "- ";
            case "numbered" -> "1. ";
            case "lettered" -> "a. ";
            case "quote" -> "> ";
            case "checklist" -> checklistPrefix(block);
            default -> "";
        };
    }

    private boolean alreadyHasBlockMarker(LineBlock block, String line) {
        String trimmed = line.stripLeading();
        return switch (block.type()) {
            case "heading1" -> trimmed.startsWith("# ");
            case "heading2" -> trimmed.startsWith("## ");
            case "heading3" -> trimmed.startsWith("### ");
            case "bullet" -> trimmed.startsWith("- ") || trimmed.startsWith("* ");
            case "numbered" -> hasNumberedPrefix(trimmed);
            case "quote" -> trimmed.startsWith("> ");
            case "checklist" -> hasChecklistPrefix(trimmed);
            default -> false;
        };
    }

    private String checklistPrefix(LineBlock block) {
        boolean checked = block.attrs() != null && Boolean.TRUE.equals(block.attrs().checked());
        return checked ? "- [x] " : "- [ ] ";
    }

    private boolean hasNumberedPrefix(String value) {
        int index = 0;
        while (index < value.length() && Character.isDigit(value.charAt(index))) index++;
        if (index == 0 || index + 1 >= value.length()) return false;
        char delimiter = value.charAt(index);
        return (delimiter == '.' || delimiter == ')') && Character.isWhitespace(value.charAt(index + 1));
    }

    private boolean hasChecklistPrefix(String value) {
        if (value.length() < 6) return false;
        char marker = value.charAt(0);
        char state = value.charAt(3);
        return (marker == '-' || marker == '*' || marker == '+')
            && value.charAt(1) == ' '
            && value.charAt(2) == '['
            && (state == ' ' || state == 'x' || state == 'X')
            && value.charAt(4) == ']'
            && Character.isWhitespace(value.charAt(5));
    }

    private String applyInlineMarks(String line, int lineStart, List<InlineMark> marks) {
        int lineEnd = lineStart + line.length();
        Map<Integer, List<MarkEdge>> openings = new HashMap<>();
        Map<Integer, List<MarkEdge>> closings = new HashMap<>();
        for (InlineMark mark : marks) addMarkEdges(mark, lineStart, lineEnd, openings, closings);
        return renderMarkedLine(line, openings, closings);
    }

    private void addMarkEdges(
        InlineMark mark,
        int lineStart,
        int lineEnd,
        Map<Integer, List<MarkEdge>> openings,
        Map<Integer, List<MarkEdge>> closings
    ) {
        int from = Math.max(mark.from(), lineStart);
        int to = Math.min(mark.to(), lineEnd);
        if (from >= to) return;
        MarkEdge edge = new MarkEdge(mark, from - lineStart, to - lineStart);
        openings.computeIfAbsent(edge.from(), ignored -> new ArrayList<>()).add(edge);
        closings.computeIfAbsent(edge.to(), ignored -> new ArrayList<>()).add(edge);
    }

    private String renderMarkedLine(
        String line,
        Map<Integer, List<MarkEdge>> openings,
        Map<Integer, List<MarkEdge>> closings
    ) {
        StringBuilder result = new StringBuilder(line.length() + 32);
        for (int position = 0; position <= line.length(); position++) {
            appendClosings(result, closings.get(position));
            appendOpenings(result, openings.get(position));
            if (position < line.length()) result.append(line.charAt(position));
        }
        return result.toString();
    }

    private void appendOpenings(StringBuilder result, List<MarkEdge> edges) {
        if (edges == null) return;
        edges.stream()
            .sorted(Comparator.comparingInt(MarkEdge::to).reversed())
            .map(edge -> openingMarker(edge.mark()))
            .forEach(result::append);
    }

    private void appendClosings(StringBuilder result, List<MarkEdge> edges) {
        if (edges == null) return;
        edges.stream()
            .sorted(Comparator.comparingInt(MarkEdge::from).reversed())
            .map(edge -> closingMarker(edge.mark()))
            .forEach(result::append);
    }

    private String openingMarker(InlineMark mark) {
        return switch (mark.type()) {
            case "bold" -> "**";
            case "italic" -> "*";
            case "inlineCode" -> "`";
            case "link" -> "[";
            case "highlight" -> "==";
            case "textColor" -> "<span style=\"color:" + safeColor(mark) + "\">";
            case "backgroundColor" -> "<span style=\"background-color:" + safeColor(mark) + "\">";
            default -> "";
        };
    }

    private String closingMarker(InlineMark mark) {
        return switch (mark.type()) {
            case "bold" -> "**";
            case "italic" -> "*";
            case "inlineCode" -> "`";
            case "link" -> "](" + safeHref(mark) + ")";
            case "highlight" -> "==";
            case "textColor", "backgroundColor" -> "</span>";
            default -> "";
        };
    }

    private String safeHref(InlineMark mark) {
        if (mark.attrs() == null || !StringUtils.hasText(mark.attrs().href())) return "";
        return mark.attrs().href().replace(" ", "%20");
    }

    private String safeColor(InlineMark mark) {
        if (mark.attrs() == null || !StringUtils.hasText(mark.attrs().color())) return "inherit";
        return mark.attrs().color().replace("\"", "").replace("'", "");
    }

    private LineBlock matchingBlock(LineSlice line, List<LineBlock> blocks) {
        return blocks.stream()
            .filter(block -> intersects(block, line))
            .min(Comparator.comparingInt(LineBlock::from))
            .orElse(null);
    }

    private boolean intersects(LineBlock block, LineSlice line) {
        if (line.start() == line.end()) return block.from() <= line.start() && block.to() >= line.end();
        return block.from() < line.end() && block.to() > line.start();
    }

    private List<LineSlice> lineSlices(String text) {
        List<LineSlice> lines = new ArrayList<>();
        int start = 0;
        for (int index = 0; index < text.length(); index++) {
            if (text.charAt(index) != '\n') continue;
            lines.add(new LineSlice(start, index));
            start = index + 1;
        }
        lines.add(new LineSlice(start, text.length()));
        return lines;
    }

    private String replaceAssetTokens(String markdown, List<BlockEntity> entities) {
        String result = markdown;
        for (BlockEntity entity : entities) {
            result = replaceAssetToken(result, entity);
        }
        return result;
    }

    private String replaceAssetToken(String markdown, BlockEntity entity) {
        String assetId = entity.assetId();
        if (!StringUtils.hasText(assetId)) return markdown;
        String replacement = assetMarkdown(entity);
        return markdown
            .replace("⟦asset:" + assetId + "⟧", replacement)
            .replace("[[asset:" + assetId + "]]", replacement)
            .replace("[asset:" + assetId + "]", replacement);
    }

    private String assetMarkdown(BlockEntity entity) {
        String fileName = assetFileName(entity);
        String displayName = assetDisplayName(entity, fileName);
        String target = "assets/" + entity.assetId() + "/" + fileName.replace(" ", "%20");
        return isImage(entity) ? "![" + displayName + "](" + target + ")" : "[" + displayName + "](" + target + ")";
    }

    private String assetFileName(BlockEntity entity) {
        if (entity.attrs() != null && StringUtils.hasText(entity.attrs().relativePath())) {
            return Path.of(entity.attrs().relativePath()).getFileName().toString();
        }
        if (entity.attrs() != null && StringUtils.hasText(entity.attrs().displayName())) {
            return entity.attrs().displayName();
        }
        return "asset-" + entity.assetId();
    }

    private String assetDisplayName(BlockEntity entity, String fileName) {
        String display = entity.attrs() == null ? null : entity.attrs().displayName();
        String value = StringUtils.hasText(display) ? display : fileName;
        return value.replace("[", "\\[").replace("]", "\\]");
    }

    private boolean isImage(BlockEntity entity) {
        if ("image".equals(entity.type())) return true;
        return entity.attrs() != null
            && StringUtils.hasText(entity.attrs().contentType())
            && entity.attrs().contentType().startsWith("image/");
    }

    private record LineSlice(int start, int end) {
    }

    private record MarkEdge(InlineMark mark, int from, int to) {
    }
}
