import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
      <h1 className="text-4xl font-bold">HalalDL</h1>
      <p className="text-muted-foreground">Tauri v2 + React + TailwindCSS + shadcn/ui</p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          className="px-3 py-2 border rounded-md bg-background"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <Button type="submit">Greet</Button>
      </form>
      <p className="font-medium">{greetMsg}</p>
    </main>
  );
}

export default App;
