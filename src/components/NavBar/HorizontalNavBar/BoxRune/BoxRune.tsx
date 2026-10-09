// Saga: each box shows its own Elder Futhark rune (set per box in /etc/weebio/box.env or by hostname,
// served by weebio-agent), so a friend can say which box they have. Drawn as SVG strokes because the
// box may not have a font with runic letters.

import React, { useEffect, useState } from 'react';
import styles from './BoxRune.less';

// Stroke paths on a 60x100 grid, keyed by rune name.
const RUNES: Record<string, string> = {
    fehu: 'M20 5V95M20 32L44 12M20 54L44 34',
    uruz: 'M16 95V5L44 30V95',
    thurisaz: 'M20 5V95M20 30L42 50L20 70',
    ansuz: 'M20 5V95M20 8L44 28M20 30L44 50',
    raidho: 'M18 95V5L42 25L18 48L42 95',
    kenaz: 'M42 12L18 50L42 88',
    gebo: 'M12 10L48 90M48 10L12 90',
    wunjo: 'M20 95V5L42 25L20 45',
    hagalaz: 'M16 5V95M44 5V95M16 35L44 62',
    naudiz: 'M30 5V95M14 35L46 62',
    isa: 'M30 5V95',
    jera: 'M28 12L12 34L28 56M32 44L48 66L32 88',
    eihwaz: 'M30 5V95M30 5L44 19M30 95L16 81',
    perthro: 'M16 5V95M16 5L30 20L44 5M16 95L30 80L44 95',
    algiz: 'M30 95V5M30 40L12 14M30 40L48 14',
    sowilo: 'M40 8L18 45L42 55L20 92',
    tiwaz: 'M30 95V5M30 5L12 28M30 5L48 28',
    berkano: 'M18 5V95M18 5L42 27L18 50L42 72L18 95',
    ehwaz: 'M14 95V5L30 28L46 5V95',
    mannaz: 'M14 95V5L46 40M46 95V5L14 40',
    laguz: 'M22 95V5L42 26',
    ingwaz: 'M30 12L48 50L30 88L12 50Z',
    dagaz: 'M12 15V85L48 15V85Z',
    othala: 'M30 8L46 30L30 52L14 30ZM20 44L44 92M40 44L16 92',
};

type Box = {
    rune: string,
    hostname: string,
};

const BoxRune = () => {
    const [box, setBox] = useState<Box | null>(null);

    useEffect(() => {
        fetch('/weebio/api/box')
            .then((response) => response.json())
            .then(setBox)
            .catch(() => setBox(null));
    }, []);

    if (!box || !RUNES[box.rune]) {
        return null;
    }

    const name = box.rune.charAt(0).toUpperCase() + box.rune.slice(1);
    return (
        <div className={styles['box-rune']} title={`${name} (${box.hostname})`}>
            <svg className={styles['glyph']} viewBox={'0 0 60 100'}>
                <path d={RUNES[box.rune]} />
            </svg>
            <div className={styles['name']}>{name}</div>
        </div>
    );
};

export default BoxRune;
