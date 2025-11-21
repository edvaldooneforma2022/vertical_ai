diff --git a/public/widget/widget.js b/public/widget/widget_v7.js
new file mode 100644
index 0000000..f7c88dd
--- /dev/null
+++ b/public/widget/widget_v7.js
@@ -0,0 +1,284 @@
+/**
+ * Vertical AI — Link Mágico Widget v7 (Híbrido)
+ * Compatível com widget v6 e totalmente expansível
+ * Inclui:
+ *   ✓ Chat Core modular
+ *   ✓ Scheduler integrado (client-side)
+ *   ✓ API Router inteligente
+ *   ✓ CSS externo
+ */
+
+import { LMChatCore } from "./modules/chat-core.js";
+import { LMScheduler } from "./modules/scheduler.js";
+import { LMApi } from "./modules/api.js";
+import { LMUtils } from "./modules/utils.js";
+
+(function (window, document) {
+    "use strict";
+
+    if (window.VerticalAIWidgetV7) return;
+
+    const VerticalAIWidgetV7 = {
+        version: "7.0-hybrid",
+        initialized: false,
+
+        init(config = {}) {
+            if (this.initialized) return;
+
+            this.config = {
+                apiBase: config.apiBase || window.location.origin,
+                robotName: config.robotName || "Assistente IA",
+                theme: config.theme || "light",
+                enableScheduler: config.enableScheduler ?? true,
+                ...config
+            };
+
+            // Load external CSS
+            LMUtils.injectCSS(`${this.config.apiBase}/public/widget/widget.css`);
+
+            // Start Chat Engine
+            this.chat = new LMChatCore(this.config);
+
+            // Scheduler Integration
+            if (this.config.enableScheduler) {
+                this.scheduler = new LMScheduler({
+                    apiBase: this.config.apiBase,
+                    onCreated: (payload) => {
+                        this.chat.showBotMessage(
+                            `🎉 Sua reunião foi agendada!\n📅 ${payload.date}\n🕒 ${payload.time}`
+                        );
+                    }
+                });
+            }
+
+            // Detect message intent
+            this.chat.onUserMessage(async (msg) => {
+                const intent = LMUtils.detectIntent(msg);
+
+                if (intent === "schedule" && this.scheduler) {
+                    this.chat.showTyping();
+                    await LMUtils.sleep(600);
+                    this.scheduler.openPrompt();
+                    return;
+                }
+
+                const response = await LMApi.sendMessage(this.config.apiBase, msg, this.chat.conversationId);
+                this.chat.showBotMessage(response);
+            });
+
+            this.initialized = true;
+            console.log("Vertical AI Widget v7 Loaded");
+        }
+    };
+
+    window.VerticalAIWidgetV7 = VerticalAIWidgetV7;
+
+})(window, document);
+
+// Auto-init if config exists
+if (window.VerticalAIWidgetV7Config) {
+    window.VerticalAIWidgetV7.init(window.VerticalAIWidgetV7Config);
+}
diff --git a/public/widget/modules/chat-core.js b/public/widget/modules/chat-core.js
new file mode 100644
index 0000000..ab98dde
--- /dev/null
+++ b/public/widget/modules/chat-core.js
@@ -0,0 +1,268 @@
+export class LMChatCore {
+    constructor(config) {
+        this.config = config;
+        this.conversationId = "conv_" + Date.now();
+
+        this.initDOM();
+    }
+
+    initDOM() {
+        const container = document.createElement("div");
+        container.id = "lm7-widget";
+
+        container.innerHTML = `
+            <div class="lm7-button" id="lm7-button">💬</div>
+
+            <div class="lm7-chat" id="lm7-chat">
+                <div class="lm7-header">${this.config.robotName}</div>
+                <div class="lm7-messages" id="lm7-messages"></div>
+
+                <div class="lm7-input-area">
+                    <textarea id="lm7-input" placeholder="Digite aqui..."></textarea>
+                    <button id="lm7-send">Enviar</button>
+                </div>
+            </div>
+        `;
+
+        document.body.appendChild(container);
+        this.hookEvents();
+    }
+
+    hookEvents() {
+        document.getElementById("lm7-button").onclick = () => {
+            document.getElementById("lm7-chat").classList.toggle("open");
+        };
+
+        document.getElementById("lm7-send").onclick = () => {
+            const input = document.getElementById("lm7-input");
+            const msg = input.value.trim();
+            if (!msg) return;
+
+            this.showUserMessage(msg);
+            this._onUserMessageCallback && this._onUserMessageCallback(msg);
+            input.value = "";
+        };
+    }
+
+    onUserMessage(callback) {
+        this._onUserMessageCallback = callback;
+    }
+
+    showBotMessage(text) {
+        const msg = document.createElement("div");
+        msg.className = "lm7-message bot";
+        msg.innerText = text;
+        document.getElementById("lm7-messages").appendChild(msg);
+    }
+
+    showUserMessage(text) {
+        const msg = document.createElement("div");
+        msg.className = "lm7-message user";
+        msg.innerText = text;
+        document.getElementById("lm7-messages").appendChild(msg);
+    }
+
+    showTyping() {
+        const msg = document.createElement("div");
+        msg.className = "lm7-message bot typing";
+        msg.innerText = "Digitando...";
+        msg.id = "lm7-typing";
+        document.getElementById("lm7-messages").appendChild(msg);
+    }
+
+    hideTyping() {
+        const t = document.getElementById("lm7-typing");
+        if (t) t.remove();
+    }
+}
diff --git a/public/widget/modules/scheduler.js b/public/widget/modules/scheduler.js
new file mode 100644
index 0000000..f0e91dd
--- /dev/null
+++ b/public/widget/modules/scheduler.js
@@ -0,0 +1,214 @@
+export class LMScheduler {
+    constructor(config) {
+        this.apiBase = config.apiBase;
+        this.onCreated = config.onCreated;
+    }
+
+    openPrompt() {
+        const date = prompt("📅 Qual dia deseja agendar?");
+        const time = prompt("🕒 Qual horário?");
+
+        if (!date || !time) return;
+
+        this.createSchedule({ date, time });
+    }
+
+    async createSchedule(payload) {
+        const result = await fetch(`${this.apiBase}/api/schedule/create`, {
+            method: "POST",
+            headers: { "Content-Type": "application/json" },
+            body: JSON.stringify(payload)
+        }).then(r => r.json());
+
+        if (result.success) {
+            this.onCreated?.(payload);
+        }
+    }
+}
diff --git a/public/widget/modules/api.js b/public/widget/modules/api.js
new file mode 100644
index 0000000..edaeff1
--- /dev/null
+++ b/public/widget/modules/api.js
@@ -0,0 +1,63 @@
+export const LMApi = {
+
+    async sendMessage(apiBase, text, conversationId) {
+
+        const result = await fetch(`${apiBase}/api/widget/chat`, {
+            method: "POST",
+            headers: { "Content-Type": "application/json" },
+            body: JSON.stringify({
+                message: text,
+                conversationId
+            })
+        });
+
+        const json = await result.json();
+        return json.response ?? "🤖 Erro ao responder";
+    }
+};
diff --git a/public/widget/modules/utils.js b/public/widget/modules/utils.js
new file mode 100644
index 0000000..d0c9aae
--- /dev/null
+++ b/public/widget/modules/utils.js
@@ -0,0 +1,133 @@
+export const LMUtils = {
+
+    injectCSS(url) {
+        const link = document.createElement("link");
+        link.rel = "stylesheet";
+        link.href = url;
+        document.head.appendChild(link);
+    },
+
+    sleep(ms) {
+        return new Promise(r => setTimeout(r, ms));
+    },
+
+    detectIntent(message) {
+        message = message.toLowerCase();
+
+        if (message.includes("agendar") ||
+            message.includes("marcar") ||
+            message.includes("reunião") ||
+            message.includes("meeting") ||
+            message.includes("agenda")) {
+            return "schedule";
+        }
+
+        return "default";
+    }
+};
diff --git a/public/widget/widget.css b/public/widget/widget.css
new file mode 100644
index 0000000..c0991aa
--- /dev/null
+++ b/public/widget/widget.css
@@ -0,0 +1,210 @@
+/* Vertical AI Widget v7 — CSS externo */
+
+#lm7-widget {
+    position: fixed;
+    bottom: 20px;
+    right: 20px;
+    z-index: 999999;
+    font-family: Arial;
+}
+
+.lm7-button {
+    width: 60px;
+    height: 60px;
+    background: #3b82f6;
+    border-radius: 50%;
+    display: flex;
+    align-items: center;
+    justify-content: center;
+    font-size: 26px;
+    color: white;
+    cursor: pointer;
+    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
+}
+
+.lm7-chat {
+    width: 360px;
+    height: 520px;
+    background: #fff;
+    border-radius: 16px;
+    box-shadow: 0 8px 40px rgba(0,0,0,0.2);
+    display: none;
+    flex-direction: column;
+}
+
+.lm7-chat.open {
+    display: flex;
+}
+
+.lm7-header {
+    background: #3b82f6;
+    color: white;
+    padding: 16px;
+    font-size: 18px;
+    border-radius: 16px 16px 0 0;
+    font-weight: bold;
+}
+
+.lm7-messages {
+    flex: 1;
+    padding: 16px;
+    overflow-y: auto;
+}
+
+.lm7-message {
+    margin-bottom: 10px;
+    padding: 10px 14px;
+    border-radius: 12px;
+    max-width: 80%;
+    line-height: 1.4;
+}
+
+.lm7-message.user {
+    background: #3b82f6;
+    color: white;
+    margin-left: auto;
+}
+
+.lm7-message.bot {
+    background: #f3f4f6;
+    color: #333;
+}
+
+.lm7-message.typing {
+    font-style: italic;
+}
+
+.lm7-input-area {
+    border-top: 1px solid #eee;
+    padding: 10px;
+    display: flex;
+    gap: 10px;
+}
+
+textarea#lm7-input {
+    flex: 1;
+    padding: 10px;
+    resize: none;
+    height: 40px;
+}
+
+button#lm7-send {
+    background: #3b82f6;
+    color: white;
+    border: none;
+    padding: 0 16px;
+    border-radius: 8px;
+    cursor: pointer;
+}
