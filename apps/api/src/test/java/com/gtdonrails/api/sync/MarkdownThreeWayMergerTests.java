package com.gtdonrails.api.sync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class MarkdownThreeWayMergerTests {

    private final MarkdownThreeWayMerger merger = new MarkdownThreeWayMerger();

    @Test
    void mergesIndependentLineChanges() {
        String base = "alpha\nbeta\ngamma";
        String local = "alpha local\nbeta\ngamma";
        String remote = "alpha\nbeta\ngamma remote";

        MarkdownThreeWayMerger.MergeResult result = merger.merge(base, local, remote);

        assertTrue(result.clean());
        assertEquals("alpha local\nbeta\ngamma remote", result.merged());
    }

    @Test
    void preservesIndependentInsertionAndEdit() {
        String base = "one\ntwo\nthree";
        String local = "one\nlocal inserted\ntwo\nthree";
        String remote = "one\ntwo\nthree remote";

        MarkdownThreeWayMerger.MergeResult result = merger.merge(base, local, remote);

        assertTrue(result.clean());
        assertEquals("one\nlocal inserted\ntwo\nthree remote", result.merged());
    }

    @Test
    void acceptsSameChangeFromBothSides() {
        MarkdownThreeWayMerger.MergeResult result = merger.merge(
            "one\ntwo",
            "one changed\ntwo",
            "one changed\ntwo"
        );

        assertTrue(result.clean());
        assertEquals("one changed\ntwo", result.merged());
    }

    @Test
    void rejectsOverlappingLineChanges() {
        MarkdownThreeWayMerger.MergeResult result = merger.merge(
            "one\ntwo\nthree",
            "one\nlocal two\nthree",
            "one\nremote two\nthree"
        );

        assertFalse(result.clean());
    }

    @Test
    void preservesTrailingNewline() {
        MarkdownThreeWayMerger.MergeResult result = merger.merge(
            "one\ntwo\n",
            "local one\ntwo\n",
            "one\nremote two\n"
        );

        assertTrue(result.clean());
        assertEquals("local one\nremote two\n", result.merged());
    }
}
