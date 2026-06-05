import { useState } from "react";
import { buildApiUrlWithVersion } from "../../config/env.ts";

type ContextNameWithIconProps = Readonly<{
  context: {
    id: string;
    name: string;
    iconUrl?: string;
    iconRevision?: number;
  };
}>;

function ContextIcon({ context }: ContextNameWithIconProps) {
  const [failedIcon, setFailedIcon] = useState(false);

  if (context.iconUrl && !failedIcon) {
    return (
      <img
        src={buildApiUrlWithVersion(context.iconUrl, context.iconRevision)}
        alt=""
        className="context-name-icon__image"
        draggable={false}
        onError={() => setFailedIcon(true)}
      />
    );
  }

  return <span className="context-name-icon__glyph" aria-hidden="true">C</span>;
}

/**
 * Renders a context name with its custom icon or crimson fallback glyph.
 *
 * @example <ContextNameWithIcon context={context} />
 */
export function ContextNameWithIcon({ context }: ContextNameWithIconProps) {
  return (
    <span className="context-name-icon">
      <ContextIcon context={context} />
      <span>{context.name}</span>
    </span>
  );
}
