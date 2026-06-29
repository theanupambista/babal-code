import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

function App() {
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center">
      <box
        border
        borderStyle="rounded"
        borderColor="#7aa2f7"
        flexDirection="column"
        alignItems="center"
        padding={2}
        gap={1}
      >
        <ascii-font text="BABALCODE" font="tiny" color="#7aa2f7" />
        <text fg="#c0caf5">Welcome to babal code</text>
        <text fg="#565f89">Press Ctrl+C to exit</text>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
