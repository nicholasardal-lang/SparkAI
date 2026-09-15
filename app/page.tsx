import {
  ArrowUpRight,
  Code2,
  Bug,
  Layers,
  Sparkles,
  Plus,
  ArrowUp,
  List,
} from "lucide-react";
import PreviewComposer from "./preview-composer";
import SiteNav from "./site-nav";
export default function Home() {
  return (
    <main>
      <SiteNav />
      <section className="hero">
        <div className="eyebrow">
          <Sparkles size={15} /> YOUR NEXT GAME STARTS WITH A SPARK
        </div>
        <h1>
          <span>SPARK</span> your
          <br />
          creativity.
        </h1>
        <p>
          Turn your ideas into Roblox games
          <br /> with an AI building partner.
        </p>
        <a className="button hero-button" href="/signup">
          Start creating <ArrowUpRight size={19} />
        </a>
        <small>From your first idea to your next big build.</small>
      </section>
      <section id="workspace" className="preview-wrap" aria-label="Chat workspace preview">
        <div className="preview-label">
          <span>TRY THE WORKSPACE</span>
          <span>Type a prompt to start</span>
        </div>
        <div className="preview">
          <aside>
            <a className="brand" href="/">
              <span className="logo-mark" aria-hidden="true">✦</span><span>Spark</span>
            </a>
            <div className="preview-new preview-control">
              <Plus size={16} /> New project
            </div>
            <small>PROJECTS</small>
            <div className="selected preview-project preview-control">
              <Layers size={15} /> My first obby
            </div>
            <div className="muted preview-project preview-control"><List size={15} /> Survival game idea</div>
            <div className="sidebar-bottom">
              Your ideas. Endless possibilities.
            </div>
          </aside>
          <div className="preview-chat">
            <header>
              <span className="preview-header-tab preview-control">My first obby</span>
              <span className="muted preview-header-tab preview-control">
                <Code2 size={16} /> Scripts
              </span>
            </header>
            <div className="preview-conversation">
              <div className="user-bubble">
                Help me create a checkpoint system for my obby.
              </div>
              <div className="example-answer">
                <span className="spark-avatar">✦</span>
                <div>
                  <b>
                    Spark <small>EXAMPLE</small>
                  </b>
                  <p>
                    Let’s make every jump count. A checkpoint system saves a
                    player’s progress as they move through your obby.
                  </p>
                  <div className="code-sample">
                    <div>
                      <span>checkpoint.server.luau</span>
                      <span>Luau</span>
                    </div>
                    <pre>
                      <span>-- Place in ServerScriptService</span>
                      {
                        '\nlocal Players = game:GetService("Players")\nlocal checkpoints = workspace.Checkpoints\n\n'
                      }
                      <span>-- Your next idea starts here.</span>
                    </pre>
                  </div>
                </div>
              </div>
              <PreviewComposer />
            </div>
          </div>
        </div>
      </section>
      <section className="social-proof" aria-label="Creator notes">
        <div className="social-proof-heading">
          <span className="eyebrow">MADE FOR THE NEXT GENERATION OF BUILDERS</span>
          <h2>More building. Less staring at a blank script.</h2>
          <p>Join 18,000 Roblox developers turning small sparks into worlds worth playing.</p>
        </div>
        <div className="claim-row">
          <span>First drafts in minutes</span>
          <span>Clearer Luau, faster</span>
          <span>Keep your momentum</span>
        </div>
        <div className="quotes">
          {[
            [
              "Spark helped me turn a rough obby idea into a plan I could actually build that night.",
              "Maya R.",
              "obby creator",
            ],
            [
              "I finally understand why my script was breaking. The fix came with an explanation, not just a patch.",
              "Jordan K.",
              "Luau learner",
            ],
            [
              "It feels like having a patient teammate beside me while I learn Roblox Studio.",
              "Alex T.",
              "indie developer",
            ],
          ].map(([quote, name, role]) => (
            <figure className="quote-card" key={name}>
              <blockquote>“{quote}”</blockquote>
              <figcaption>
                <span className="quote-avatar">{name[0]}</span>
                <span>
                  <b>{name}</b>
                  <small>{role}</small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="sample-copy-note">Sample creator quotes and launch-preview social proof.</p>
      </section>
      <section id="how" className="how">
        <div className="section-heading">
          <span className="eyebrow">A LITTLE IDEA. A WHOLE NEW WORLD.</span>
          <h2>Make something worth playing.</h2>
          <p>You bring the imagination. Spark helps with the next step.</p>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Create a project",
              "Give your game a home. Keep your ideas, scripts, and conversations together.",
            ],
            [
              "02",
              "Describe your idea",
              "Start with a sentence, a question, or a script that needs a little help.",
            ],
            [
              "03",
              "Build and refine",
              "Take your scripts into Roblox Studio. Test, learn, and keep creating.",
            ],
          ].map(([n, t, d]) => (
            <article key={n}>
              <span className="step-number">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
        <div id="features" className="features">
          {[
            [
              Layers,
              "Find your game",
              "Shape mechanics, game loops, and a plan you can actually build.",
            ],
            [
              Code2,
              "Turn ideas into Luau",
              "Generate readable scripts with guidance on where they belong.",
            ],
            [
              Bug,
              "Get unstuck",
              "Understand errors and work through fixes with a building partner.",
            ],
          ].map(([Icon, t, d]: any) => (
            <article key={t}>
              <Icon size={24} />
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
        <div className="integration">
          <div>
            <h3>Closer to your canvas.</h3>
            <p>Roblox Studio integration</p>
          </div>
          <span className="pill">Coming soon</span>
        </div>
      </section>
      <section className="closing-cta">
        <h2>Ready to <span>SPARK</span> your next game?</h2>
        <p>Create your first project and start the conversation.</p>
        <div><a className="button" href="/signup">Start creating <ArrowUpRight size={20} /></a><a className="button secondary" href="/pricing">See plans and pricing</a></div>
      </section>
      <footer>
        <a className="brand" href="/">
          <svg className="footer-logo-mark" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C13.8 7.2 16.8 10.2 24 12C16.8 13.8 13.8 16.8 12 24C10.2 16.8 7.2 13.8 0 12C7.2 10.2 10.2 7.2 12 0Z" /></svg><span>Spark</span>
        </a>
        <p>Independent from Roblox, Anthropic, and OpenAI.</p>
        <span>SPARK your creativity</span>
      </footer>
    </main>
  );
}
