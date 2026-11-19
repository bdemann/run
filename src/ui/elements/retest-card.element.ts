import {css, defineElement, html, listen} from 'element-vir';
import {screenStyles} from '../styles.js';

/** "It's been a while" prompt shared by the Workout and Goals screens. */
export const RetestCard = defineElement<{onRetest: () => void}>()({
    tagName: 'retest-card',
    styles: css`
        ${screenStyles}

        .card {
            background: var(--run-go-bg);
        }
    `,
    render({inputs}) {
        return html`
            <div class="card">
                <p>It's been a while. Retest to see how far you've come.</p>
                <button type="button" ${listen('click', () => inputs.onRetest())}>Retest</button>
            </div>
        `;
    },
});
