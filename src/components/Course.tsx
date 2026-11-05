import type { Progress } from '../../shared/progress';
import type { Level } from '../types';
import type { Unit } from '../lib/study';
import { LEVELS } from '../types';

export default function Course({ units, level, progress, onLearn, onTest, onAssessment }: {
  units: Unit[]; level: Level; progress: Progress; onLearn: (unit: Unit) => void; onTest: (unit: Unit) => void; onAssessment: () => void;
}) {
  const previous = LEVELS[LEVELS.indexOf(level) - 1];
  const levelUnlocked = !previous || progress.units[`level-${previous}`]?.passed;
  const done = units.filter(unit => progress.units[unit.id]?.passed).length;
  return <>
    <div className="panel course-intro">
      <div><h2>{level}</h2><p>Pass each unit at 80% to unlock the next.</p></div>
      <div className="course-progress"><strong>{done} / {units.length}</strong><span>units passed</span><progress max={Math.max(1, units.length)} value={done} aria-label={`${level} units passed`} /></div>
    </div>
    {!levelUnlocked && <aside className="notice"><strong>This level is locked.</strong> Complete {previous}, or pass its level assessment. You can still browse and practise any content from the libraries.</aside>}
    <div className="section-heading"><h3>Your units</h3><button onClick={onAssessment}>Take {level} level assessment</button></div>
    <div className="unit-list">{units.map((unit, index) => {
      const result = progress.units[unit.id];
      const unlocked = levelUnlocked && (index === 0 || progress.units[units[index - 1].id]?.passed);
      return <article className={`unit ${result?.passed ? 'passed' : ''} ${!unlocked ? 'locked' : ''}`} key={unit.id}>
        <span className="unit-number">{result?.passed ? '✓' : index + 1}</span>
        <div className="grow"><span className="eyebrow">{unit.kind} · {unit.items.length} {unit.kind === 'Grammar' ? 'lesson' : 'items'}</span><h3>{unit.title}</h3>{result && <p className="small">{result.passed ? 'Passed' : 'Best score'}: {Math.round(result.score)}%</p>}</div>
        <div className="button-row"><button disabled={!unlocked} onClick={() => onLearn(unit)}>Learn</button><button className="primary" disabled={!unlocked} onClick={() => onTest(unit)}>{!unlocked ? 'Locked' : result?.passed ? 'Retake test' : 'Unit test'}</button></div>
      </article>;
    })}</div>
  </>;
}
