import { useEffect, useRef, useState } from "react";
import Shell from "./Shell.jsx";
import { MCP_SETUPS, OPTIONS, RUNS } from "./demo.js";

const INSTALL = "npx standup-ai";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function CopyButton({ text, label = "copy" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={`copy ${copied ? "is-copied" : ""}`} onClick={copy}>
      {copied ? "copied" : label}
    </button>
  );
}

function Tabs({ items, active, onPick, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item, i) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={i === active}
          className={`tab ${i === active ? "is-active" : ""}`}
          onClick={() => onPick(i)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

// Types the command, then prints the output a line at a time. Remounted per
// tab (key), so every run starts from an empty screen.
function TermBody({ command, lines }) {
  const still = reducedMotion();
  const [typed, setTyped] = useState(still ? command.length : 0);
  const [shown, setShown] = useState(still ? lines.length : 0);

  useEffect(() => {
    if (still) return undefined;
    let t = 0;
    let s = 0;
    const id = setInterval(() => {
      if (t < command.length) setTyped(++t);
      else if (s < lines.length) setShown(++s);
      else clearInterval(id);
    }, 38);
    return () => clearInterval(id);
  }, [still, command, lines]);

  return (
    <pre className="term-body" aria-live="polite">
      <span className="prompt">~ $ </span>
      {command.slice(0, typed)}
      {shown < lines.length ? <span className="caret" aria-hidden="true" /> : null}
      {"\n"}
      {lines.slice(0, shown).map(([style, text], i) => (
        <span key={i} className={style ? `t-${style}` : undefined}>
          {text}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}

function Terminal() {
  const [run, setRun] = useState(0);
  return (
    <div className="term">
      <div className="term-bar">
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <Tabs items={RUNS.map((r) => r.tab)} active={run} onPick={setRun} label="example runs" />
      </div>
      <TermBody key={run} {...RUNS[run]} />
    </div>
  );
}

function McpSetup() {
  const [active, setActive] = useState(0);
  const setup = MCP_SETUPS[active];
  return (
    <div className="card">
      <Tabs items={MCP_SETUPS.map((s) => s.tab)} active={active} onPick={setActive} label="MCP clients" />
      <p className="hint">{setup.hint}</p>
      <div className="code-wrap">
        <pre className="code">{setup.code}</pre>
        <CopyButton text={setup.code} />
      </div>
    </div>
  );
}

const STEPS = [
  ["finds your repos", "Looks through the folders you give it (three levels deep) for git repos. Work, side projects, all of it."],
  ["reads your work", "Only your commits, matched by your git email, plus fresh uncommitted changes and the branch you're on."],
  ["writes the update", "Gemini turns commit messages into plain sentences. No key? You get a clean list of commits instead."],
];

const ASKS = [
  "what did I ship this week?",
  "write my standup for today",
  "draft my weekly update for my manager",
  "which repos did I touch since monday?",
];

export default function App() {
  return (
    <Shell repo="standup">
      <header className="hero">
        <p className="eyebrow">cli · mcp server · zero dependencies</p>
        <h1>
          standup<span className="h1-dot">.</span>
        </h1>
        <p className="lede">
          your daily standup, <em>written from your git commits.</em> one command gives you what you did, what's next
          and what's blocking you, ready to paste.
        </p>
        <div className="install">
          <code>
            <span className="prompt">$ </span>
            {INSTALL}
          </code>
          <CopyButton text={INSTALL} />
        </div>
        <p className="hint">needs node 18+ and git. run it from the folder that holds your projects.</p>
      </header>

      <Terminal />

      <section className="section">
        <h2>how it works</h2>
        <ol className="steps">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="step">
              <span className="step-n">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
        <p className="hint">
          for the written summary, set <code>GEMINI_API_KEY</code>. a free key takes a minute at{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com
          </a>
          .
        </p>
      </section>

      <section className="section">
        <h2>
          ask claude what you <em>shipped</em>
        </h2>
        <p className="body">
          <code>standup mcp</code> runs as an MCP server, so Claude, Cursor or any MCP client can read your git activity
          and answer from it. no API key needed for this, your assistant does the writing.
        </p>
        <McpSetup />
        <ul className="asks">
          {ASKS.map((a) => (
            <li key={a}>“{a}”</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>options</h2>
        <dl className="options">
          {OPTIONS.map(([flag, desc]) => (
            <div key={flag} className="option">
              <dt>
                <code>{flag}</code>
              </dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
        <p className="hint">
          set <code>STANDUP_DIRS</code> to your project folders once and it works from any folder.{" "}
          <code>npm i -g standup-ai</code> lets you type just <code>standup</code>.
        </p>
      </section>

      <section className="section privacy">
        <h2>your code stays put</h2>
        <p className="body">
          everything runs on your machine. only commit messages and changed file names are sent, and only to Gemini when
          you set a key. <code>--raw</code> and the MCP server send nothing anywhere.
        </p>
      </section>
    </Shell>
  );
}
