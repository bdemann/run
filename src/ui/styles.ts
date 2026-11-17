import {css} from 'element-vir';

/** Controls and cards every screen shares. 44px touch targets and a visible focus ring. */
export const screenStyles = css`
    :host {
        display: block;
        color: var(--run-text);
    }

    h2 {
        margin: 16px 0 8px;
        font-size: 20px;
    }

    p {
        margin: 6px 0;
    }

    .muted {
        color: var(--run-muted);
        font-size: 15px;
    }

    .card {
        box-sizing: border-box;
        margin: 0 0 12px;
        padding: 16px;
        border: 1px solid var(--run-border);
        border-radius: 14px;
        background: var(--run-surface);
    }

    button,
    .button-like {
        box-sizing: border-box;
        min-width: 44px;
        min-height: 44px;
        padding: 0 14px;
        border: 1px solid var(--run-border);
        border-radius: 10px;
        background: var(--run-surface);
        color: var(--run-text);
        font: inherit;
        cursor: pointer;
    }

    button.primary {
        width: 100%;
        min-height: 56px;
        margin-top: 8px;
        border-color: var(--run-accent);
        background: var(--run-accent);
        color: var(--run-on-accent);
        font-size: 18px;
        font-weight: 700;
    }

    button.link {
        width: 100%;
        border: none;
        background: none;
        color: var(--run-accent);
    }

    button.danger {
        color: var(--run-danger);
    }

    button:disabled {
        opacity: 0.6;
        cursor: progress;
    }

    input,
    textarea {
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 8px 10px;
        border: 1px solid var(--run-border);
        border-radius: 8px;
        background: var(--run-surface);
        color: var(--run-text);
        font: inherit;
    }

    label {
        display: block;
        color: var(--run-muted);
        font-size: 15px;
    }

    label > input,
    label > textarea {
        margin-top: 4px;
    }

    :is(button, input, textarea, a, .button-like):focus-visible {
        outline: 3px solid var(--run-focus);
        outline-offset: 2px;
    }

    .error {
        color: var(--run-danger);
    }
`;
