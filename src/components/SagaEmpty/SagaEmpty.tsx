// Saga: empty-state illustration (replaces Stremio's mascot, assets/images/empty.png): an open book with
// the Saga rune, drawn as strokes in the active theme's accent. Callers size it with their own className.

import React from 'react';
import classNames from 'classnames';
import styles from './SagaEmpty.less';

type Props = {
    className?: string,
};

const SagaEmpty = ({ className }: Props) => (
    <div className={classNames(className, styles['saga-empty'])} role={'img'}>
        <svg viewBox={'0 0 120 100'}>
            <path d={'M60 26C47 18 30 16 14 20V80C30 76 47 78 60 86C73 78 90 76 106 80V20C90 16 73 18 60 26Z'} />
            <path d={'M60 26V86'} />
            <path className={styles['lines']} d={'M24 34C33 32 42 33 50 36M24 44C33 42 42 43 50 46M24 54C31 52.5 37 53 43 55M70 36C78 33 87 32 96 34M70 46C78 43 87 42 96 44'} />
            <path d={'M86 52L79 61L88 63L81 72'} />
        </svg>
    </div>
);

export default SagaEmpty;
