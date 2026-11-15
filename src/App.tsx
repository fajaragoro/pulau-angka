import { useEffect, useState } from 'react';
import { accessValid } from './core/backup';
import { type Summary, applySession } from './core/progress';
import { type BonusMode, type SessionAnswer, type SessionPlan, buildBonusPlan, buildReplayPlan } from './core/session';
import { todayStr } from './core/util';
import { ACCESS } from './config';
import { requestPersist } from './storage/db';
import { CodeEntry, Profiles } from './ui/Access';
import { type DemoKid, DemoResult, DemoSession, Home, Secret } from './ui/Demo';
import { Certificate, ParentArea, Privacy, ReportView } from './ui/Parent';
import { BonusMenu, BonusSession, DailySession, ProfileHome, SummaryView } from './ui/Play';
import { Kantin } from './ui/Kantin';
import { ParentGate } from './ui/parts';
import { flags, useStore } from './ui/store';

type Route =
  | { n: 'home' | 'secret' | 'demo' | 'code' | 'profiles' | 'phome' | 'session' | 'bonus' | 'cert' | 'parent' | 'kantin' }
  | { n: 'demoResult'; answers: SessionAnswer[] }
  | { n: 'summary'; s: Summary }
  | { n: 'bonusRun'; plan: SessionPlan }
  | { n: 'replay'; plan: SessionPlan }
  | { n: 'report'; from: 'phome' | 'parent' | 'cert' }
  | { n: 'privacy'; back: Route };

function loadKid(): DemoKid | null {
  try {
    const raw = flags.get('demo_kid');
    return raw ? (JSON.parse(raw) as DemoKid) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const { account, updateProfile } = useStore();
  const hasAccess = accessValid(account.access, ACCESS);
  const [route, setRoute] = useState<Route>({ n: hasAccess ? 'profiles' : 'home' });
  const [kid, setKid] = useState<DemoKid | null>(loadKid);
  const [pid, setPid] = useState<string | null>(null);
  const [gate, setGate] = useState<Route | null>(null);
  const profile = account.profiles.find((p) => p.id === pid) ?? null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);
  useEffect(() => {
    if (hasAccess) requestPersist();
  }, [hasAccess]);

  const go = (n: Exclude<Route['n'], 'demoResult' | 'summary' | 'bonusRun' | 'replay' | 'report' | 'privacy'>) => setRoute({ n });
  const toCode = () => go(hasAccess ? 'profiles' : 'code');
  const afterParent = (): Route => ({ n: profile ? 'phome' : 'profiles' });

  const finishSession = (plan: SessionPlan, answers: SessionAnswer[]) => {
    if (!profile) return;
    const { profile: next, summary } = applySession(profile, plan, answers, todayStr());
    updateProfile(profile.id, () => next);
    setRoute({ n: 'summary', s: summary });
  };
  const startBonus = (m: BonusMode) => {
    const plan = profile && buildBonusPlan(profile, m);
    if (plan) setRoute({ n: 'bonusRun', plan });
  };

  const startReplay = () => {
    const plan = profile && buildReplayPlan(profile, todayStr());
    if (plan) setRoute({ n: 'replay', plan });
  };

  let screen;
  switch (route.n) {
    case 'home':
      screen = (
        <Home
          initial={kid}
          onCode={toCode}
          onPrivacy={() => setRoute({ n: 'privacy', back: route })}
          onStart={(k) => {
            setKid(k);
            flags.set('demo_kid', JSON.stringify(k));
            go('secret');
          }}
        />
      );
      break;
    case 'secret':
      screen = <Secret name={kid?.name ?? ''} onDone={() => go('demo')} />;
      break;
    case 'demo':
      screen = <DemoSession kid={kid!} onQuit={() => go('home')} onFinish={(answers) => setRoute({ n: 'demoResult', answers })} />;
      break;
    case 'demoResult':
      screen = <DemoResult kid={kid!} answers={route.answers} onCode={toCode} onReplay={() => go('demo')} />;
      break;
    case 'code':
      screen = <CodeEntry onOk={() => go('profiles')} onBack={() => go('home')} />;
      break;
    case 'profiles':
      screen = (
        <Profiles
          hint={kid}
          onParent={() => setGate({ n: 'parent' })}
          onPick={(id) => {
            setPid(id);
            go('phome');
          }}
        />
      );
      break;
    default:
      screen = null;
  }

  if (route.n === 'privacy') {
    screen = <Privacy onBack={() => setRoute(route.back)} />;
  } else if (route.n === 'parent') {
    screen = (
      <ParentArea
        onBack={() => setRoute(afterParent())}
        onPrivacy={() => setRoute({ n: 'privacy', back: route })}
        onReport={(id) => {
          setPid(id);
          setRoute({ n: 'report', from: 'parent' });
        }}
      />
    );
  }

  if (!screen) {
    if (!hasAccess || !profile) {
      screen = <Profiles hint={kid} onParent={() => setGate({ n: 'parent' })} onPick={(id) => { setPid(id); go('phome'); }} />;
    } else {
      switch (route.n) {
        case 'phome':
          screen = <ProfileHome p={profile} onPlay={() => go('session')} onBonus={() => go('bonus')} onReport={() => setRoute({ n: 'report', from: 'phome' })} onCert={() => go('cert')} onReplay={startReplay} onKantin={() => go('kantin')} onSwitch={() => go('profiles')} onParent={() => setGate({ n: 'parent' })} />;
          break;
        case 'session':
          screen = <DailySession key={profile.progress.sessionsDone} p={profile} onFinish={finishSession} onQuit={() => go('phome')} />;
          break;
        case 'summary':
          screen = <SummaryView p={profile} s={route.s} onHome={() => go('phome')} onBonus={() => go('bonus')} onCert={() => go('cert')} onReplay={startReplay} onKantin={() => go('kantin')} onNext={() => go('session')} />;
          break;
        case 'replay':
          screen = <DailySession key="replay" p={profile} replay={route.plan} onFinish={finishSession} onQuit={() => go('phome')} />;
          break;
        case 'kantin':
          screen = <Kantin p={profile} onBack={() => go('phome')} />;
          break;
        case 'bonus':
          screen = <BonusMenu p={profile} onPick={startBonus} onBack={() => go('phome')} />;
          break;
        case 'bonusRun':
          screen = <BonusSession plan={route.plan} onFinish={(a) => finishSession(route.plan, a)} onQuit={() => go('bonus')} />;
          break;
        case 'report':
          screen = <ReportView p={profile} onBack={() => go(route.from)} />;
          break;
        case 'cert':
          screen = <Certificate p={profile} onBack={() => go('phome')} onReport={() => setRoute({ n: 'report', from: 'cert' })} />;
          break;
      }
    }
  }

  return (
    <>
      {screen}
      {gate && (
        <ParentGate
          reason="Area ini berisi pengaturan dan data latihan."
          onCancel={() => setGate(null)}
          onPass={() => {
            setRoute(gate);
            setGate(null);
          }}
        />
      )}
    </>
  );
}
