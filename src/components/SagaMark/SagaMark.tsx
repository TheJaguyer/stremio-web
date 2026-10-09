// Saga: the brand mark (icon) or wordmark (logo), drawn inline from branding/*.svg so its gold-leaf
// gradient can be recoloured by the active theme (see SagaMark.less). PNG renders stay gold.

import React from 'react';
import classNames from 'classnames';
import styles from './SagaMark.less';

const SVG = {
    icon: require('/assets/images/saga_icon.svg?raw') as string,
    logo: require('/assets/images/saga_logo.svg?raw') as string,
};

type Props = {
    className?: string,
    variant?: keyof typeof SVG,
};

const SagaMark = ({ className, variant = 'icon' }: Props) => (
    <div
        className={classNames(className, styles['saga-mark'])}
        role={'img'}
        dangerouslySetInnerHTML={{ __html: SVG[variant] }}
    />
);

export default SagaMark;
