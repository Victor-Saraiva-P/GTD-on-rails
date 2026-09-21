package com.gtdonrails.api.sync;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

@Component
public class MarkdownThreeWayMerger {

    /**
     * Conservatively merges independent line edits from local and remote Markdown.
     *
     * <p>Example: {@code merger.merge(base, local, remote)}.</p>
     */
    public MergeResult merge(String base, String local, String remote) {
        if (local.equals(remote)) return MergeResult.clean(local);
        if (local.equals(base)) return MergeResult.clean(remote);
        if (remote.equals(base)) return MergeResult.clean(local);
        List<String> baseLines = lines(base);
        List<LineEdit> localEdits = diff(baseLines, lines(local));
        List<LineEdit> remoteEdits = diff(baseLines, lines(remote));
        if (hasConflict(localEdits, remoteEdits)) return MergeResult.conflict();
        return MergeResult.clean(apply(baseLines, mergeEdits(localEdits, remoteEdits)));
    }

    private List<LineEdit> diff(List<String> base, List<String> target) {
        int[][] lcs = lcsMatrix(base, target);
        List<LineEdit> edits = new ArrayList<>();
        int baseIndex = 0;
        int targetIndex = 0;
        while (baseIndex < base.size() || targetIndex < target.size()) {
            if (sameLine(base, target, baseIndex, targetIndex)) {
                baseIndex++;
                targetIndex++;
                continue;
            }
            DiffCursor cursor = consumeEdit(base, target, lcs, baseIndex, targetIndex);
            edits.add(cursor.edit());
            baseIndex = cursor.baseIndex();
            targetIndex = cursor.targetIndex();
        }
        return edits;
    }

    private DiffCursor consumeEdit(
        List<String> base,
        List<String> target,
        int[][] lcs,
        int baseIndex,
        int targetIndex
    ) {
        int start = baseIndex;
        List<String> replacement = new ArrayList<>();
        while (!sameLine(base, target, baseIndex, targetIndex)) {
            if (baseIndex >= base.size() && targetIndex >= target.size()) break;
            if (takeTargetLine(base, target, lcs, baseIndex, targetIndex)) {
                replacement.add(target.get(targetIndex++));
            } else {
                baseIndex++;
            }
        }
        return new DiffCursor(baseIndex, targetIndex, new LineEdit(start, baseIndex, replacement));
    }

    private boolean takeTargetLine(
        List<String> base,
        List<String> target,
        int[][] lcs,
        int baseIndex,
        int targetIndex
    ) {
        if (targetIndex >= target.size()) return false;
        if (baseIndex >= base.size()) return true;
        return lcs[baseIndex][targetIndex + 1] >= lcs[baseIndex + 1][targetIndex];
    }

    private boolean sameLine(
        List<String> base,
        List<String> target,
        int baseIndex,
        int targetIndex
    ) {
        return baseIndex < base.size()
            && targetIndex < target.size()
            && base.get(baseIndex).equals(target.get(targetIndex));
    }

    private int[][] lcsMatrix(List<String> base, List<String> target) {
        int[][] lcs = new int[base.size() + 1][target.size() + 1];
        for (int i = base.size() - 1; i >= 0; i--) {
            for (int j = target.size() - 1; j >= 0; j--) {
                lcs[i][j] = base.get(i).equals(target.get(j))
                    ? lcs[i + 1][j + 1] + 1
                    : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
        return lcs;
    }

    private boolean hasConflict(List<LineEdit> local, List<LineEdit> remote) {
        for (LineEdit left : local) {
            for (LineEdit right : remote) {
                if (sameEdit(left, right)) continue;
                if (overlap(left, right)) return true;
            }
        }
        return false;
    }

    private boolean sameEdit(LineEdit left, LineEdit right) {
        return left.start() == right.start()
            && left.end() == right.end()
            && left.replacement().equals(right.replacement());
    }

    private boolean overlap(LineEdit left, LineEdit right) {
        if (left.isInsertion() && right.isInsertion()) return left.start() == right.start();
        if (left.isInsertion()) return insideChangedRange(left.start(), right);
        if (right.isInsertion()) return insideChangedRange(right.start(), left);
        return left.start() < right.end() && right.start() < left.end();
    }

    private boolean insideChangedRange(int position, LineEdit edit) {
        return position >= edit.start() && position < edit.end();
    }

    private List<LineEdit> mergeEdits(List<LineEdit> local, List<LineEdit> remote) {
        List<LineEdit> merged = new ArrayList<>(local);
        for (LineEdit edit : remote) {
            if (merged.stream().noneMatch(existing -> sameEdit(existing, edit))) merged.add(edit);
        }
        merged.sort(Comparator.comparingInt(LineEdit::start).reversed());
        return merged;
    }

    private String apply(List<String> base, List<LineEdit> edits) {
        List<String> merged = new ArrayList<>(base);
        for (LineEdit edit : edits) {
            merged.subList(edit.start(), edit.end()).clear();
            merged.addAll(edit.start(), edit.replacement());
        }
        return String.join("\n", merged);
    }

    private List<String> lines(String value) {
        return List.of(value.split("\n", -1));
    }

    private record LineEdit(int start, int end, List<String> replacement) {
        boolean isInsertion() {
            return start == end;
        }
    }

    private record DiffCursor(int baseIndex, int targetIndex, LineEdit edit) {
    }

    public record MergeResult(boolean clean, String merged) {

        static MergeResult clean(String value) {
            return new MergeResult(true, value);
        }

        static MergeResult conflict() {
            return new MergeResult(false, null);
        }
    }
}
