import { ChangeSet } from "@codemirror/state";
import { type ItemBody, type InlineMark, type LineBlock, type BlockEntity } from "./types";

export function normalizeBodyForClient(body: ItemBody | string | null | undefined): ItemBody {
  if (!body) {
    return { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
  }
  if (typeof body === "string") {
    return { text: body, inlineMarks: [], lineBlocks: [], blockEntities: [] };
  }
  return {
    text: body.text ?? "",
    inlineMarks: body.inlineMarks ?? [],
    lineBlocks: body.lineBlocks ?? [],
    blockEntities: body.blockEntities ?? []
  };
}

export function mapBodyRangesThroughChanges(body: ItemBody, changes: ChangeSet): ItemBody {
  const mapRange = (from: number, to: number) => {
    const newFrom = changes.mapPos(from, 1);
    const newTo = changes.mapPos(to, -1);
    return { newFrom, newTo, valid: newFrom <= newTo };
  };

  const newInlineMarks = body.inlineMarks
    .map(mark => {
      const { newFrom, newTo, valid } = mapRange(mark.from, mark.to);
      return valid && newFrom < newTo ? { ...mark, from: newFrom, to: newTo } : null;
    })
    .filter((m): m is InlineMark => m !== null);

  const newLineBlocks = body.lineBlocks
    .map(block => {
      const { newFrom, newTo, valid } = mapRange(block.from, block.to);
      return valid ? { ...block, from: newFrom, to: newTo } : null;
    })
    .filter((m): m is LineBlock => m !== null);

  const newBlockEntities = body.blockEntities
    .map(entity => {
      const { newFrom, newTo, valid } = mapRange(entity.from, entity.to);
      return valid ? { ...entity, from: newFrom, to: newTo } : null;
    })
    .filter((m): m is BlockEntity => m !== null);

  return {
    ...body,
    inlineMarks: newInlineMarks,
    lineBlocks: newLineBlocks,
    blockEntities: newBlockEntities
  };
}

export function applyInlineMark(body: ItemBody, type: InlineMark["type"], from: number, to: number, attrs?: InlineMark["attrs"]): ItemBody {
  if (from >= to) return body;
  
  const newMark: InlineMark = {
    id: crypto.randomUUID(),
    type,
    from,
    to,
    attrs
  };
  
  const filteredMarks = body.inlineMarks.filter(m => !(m.type === type && Math.max(m.from, from) < Math.min(m.to, to)));

  return {
    ...body,
    inlineMarks: [...filteredMarks, newMark]
  };
}

export function removeInlineMarks(body: ItemBody, from: number, to: number): ItemBody {
  return {
    ...body,
    inlineMarks: body.inlineMarks.filter(m => m.to <= from || m.from >= to)
  };
}

export function toggleInlineMark(body: ItemBody, type: InlineMark["type"], from: number, to: number): ItemBody {
  if (from >= to) return body;
  
  const hasMark = body.inlineMarks.some(m => m.type === type && Math.max(m.from, from) < Math.min(m.to, to));
  
  if (hasMark) {
    return {
      ...body,
      inlineMarks: body.inlineMarks.filter(m => !(m.type === type && Math.max(m.from, from) < Math.min(m.to, to)))
    };
  } else {
    return applyInlineMark(body, type, from, to);
  }
}

export function setLineBlock(body: ItemBody, type: LineBlock["type"], from: number, to: number, attrs?: LineBlock["attrs"]): ItemBody {
  const newBlock: LineBlock = {
    id: crypto.randomUUID(),
    type,
    from,
    to,
    attrs
  };
  
  const filteredBlocks = body.lineBlocks.filter(b => Math.max(b.from, from) >= Math.min(b.to, to));

  return {
    ...body,
    lineBlocks: [...filteredBlocks, newBlock]
  };
}

export function clearLineBlock(body: ItemBody, from: number, to: number): ItemBody {
  return {
    ...body,
    lineBlocks: body.lineBlocks.filter(b => Math.max(b.from, from) >= Math.min(b.to, to))
  };
}

export function toggleChecklist(body: ItemBody, from: number, to: number, checked: boolean): ItemBody {
  const existing = body.lineBlocks.find(b => b.type === "checklist" && Math.max(b.from, from) < Math.min(b.to, to));
  if (existing) {
    return {
      ...body,
      lineBlocks: body.lineBlocks.map(b => b.id === existing.id ? { ...b, attrs: { ...b.attrs, checked } } : b)
    };
  }
  return setLineBlock(body, "checklist", from, to, { checked });
}

export function insertBlockEntity(body: ItemBody, entity: Omit<BlockEntity, "id">): ItemBody {
  return {
    ...body,
    blockEntities: [...body.blockEntities, { ...entity, id: crypto.randomUUID() }]
  };
}
