<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { ChatMessage } from "$lib/api";
    import { fetchHistory, sendMessage } from "$lib/api";
  
    let sessionId: string | undefined;
    let input = "";
    let messages: ChatMessage[] = [];
    let sending = false;
    let listEl: HTMLDivElement | null = null;
  
    async function scrollToBottom() {
      await tick();
      if (listEl) listEl.scrollTop = listEl.scrollHeight;
    }
  
    onMount(async () => {
      sessionId = localStorage.getItem("sessionId") ?? undefined;
      if (!sessionId) return;
  
      try {
        const data = await fetchHistory(sessionId);
        messages = data.messages.map((m) => ({
          sender: m.sender,
          text: m.text,
          id: m.id,
          createdAt: m.createdAt,
        }));
        await scrollToBottom();
      } catch {
        // If history load fails, start fresh (don’t brick UX)
        localStorage.removeItem("sessionId");
        sessionId = undefined;
      }
    });
  
    async function handleSend() {
      const msg = input.trim();
      if (!msg || sending) return;
  
      input = "";
      messages = [...messages, { sender: "user", text: msg }];
      sending = true;
      await scrollToBottom();
  
      try {
        const res = await sendMessage({ sessionId, message: msg });
        sessionId = res.sessionId;
        localStorage.setItem("sessionId", sessionId);
  
        messages = [...messages, { sender: "ai", text: res.reply }];
      } catch (e) {
        const errText =
          e instanceof Error ? e.message : "Something went wrong";
        messages = [
          ...messages,
          {
            sender: "ai",
            text:
              "Sorry — something went wrong.\n" +
              `(${errText})`,
          },
        ];
      } finally {
        sending = false;
        await scrollToBottom();
      }
    }
  
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  
    function resetSession() {
      localStorage.removeItem("sessionId");
      sessionId = undefined;
      messages = [];
    }
  </script>
  
  <main class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="w-full max-w-2xl bg-white border rounded-xl shadow-sm">
      <div class="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <div class="font-semibold">SpurStore Support</div>
          <div class="text-xs text-slate-500">
            Ask about shipping, returns, refunds, support hours
          </div>
        </div>
  
        <button
          class="text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50"
          on:click={resetSession}
          type="button"
        >
          New chat
        </button>
      </div>
  
      <div
        class="h-[480px] overflow-y-auto px-4 py-3 space-y-3"
        bind:this={listEl}
      >
        {#if messages.length === 0}
          <div class="text-sm text-slate-600">
            Try:
            <ul class="list-disc ml-5 mt-2 space-y-1">
              <li>What’s your return policy?</li>
              <li>Do you ship to USA?</li>
              <li>What are your support hours?</li>
            </ul>
          </div>
        {/if}
  
        {#each messages as m (m.id ?? `${m.sender}-${m.text}`)}
          <div class="flex {m.sender === 'user' ? 'justify-end' : 'justify-start'}">
            <div
              class={
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm " +
                (m.sender === "user"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-900")
              }
            >
              {m.text}
            </div>
          </div>
        {/each}
  
        {#if sending}
          <div class="flex justify-start">
            <div class="max-w-[80%] rounded-2xl px-3 py-2 text-sm bg-slate-100 text-slate-700">
              Agent is typing…
            </div>
          </div>
        {/if}
      </div>
  
      <div class="border-t p-3">
        <div class="flex gap-2">
          <textarea
            class="flex-1 resize-none border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            rows="2"
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            bind:value={input}
            on:keydown={onKeyDown}
            disabled={sending}
          >
          </textarea>
          
  
          <button
            class="px-4 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50"
            on:click={handleSend}
            disabled={sending || !input.trim()}
            type="button"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  </main>