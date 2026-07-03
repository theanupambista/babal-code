export function bullet(items: Array<string | string[]>): string[] {
  return items.flatMap((item) =>
    Array.isArray(item) ? item.map((s) => `  - ${s}`) : [` - ${item}`],
  );
}

export function section(heading: string, items: Array<string | string[]>): string {
  return [heading, ...bullet(items)].join("\n");
}

export function joinSections(sections: string[]): string {
  return sections.filter(Boolean).join("\n\n");
}
