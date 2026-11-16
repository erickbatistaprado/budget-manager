'use client';

import { LanguageSwitcher, MenuButton } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import { authenticationService } from '@/services';
import { usePathname, useRouter } from 'next/navigation';
import type { JSX } from 'react';
import { CgProfile } from 'react-icons/cg';
import { FaHome } from 'react-icons/fa';
import { FiTarget, FiUpload } from 'react-icons/fi';
import {
  PiSignOutBold,
  PiPiggyBank,
  PiBank,
  PiCreditCard,
} from 'react-icons/pi';
import { VscGraph } from 'react-icons/vsc';

interface SideMenuProps {
  onClose: () => void;
}

export default function SideMenu({
  onClose,
}: Readonly<SideMenuProps>): JSX.Element {
  const pathname: string = usePathname();
  const { push } = useRouter();
  const { t } = useI18n();

  function isActive(path: string): boolean {
    return pathname === path;
  }

  function onClick(path: string): void {
    onClose();
    push(path);
  }

  return (
    <div className="flex h-full w-full max-w-xs flex-col bg-[var(--ctp-mantle)]/95 p-6 shadow-xl backdrop-blur-sm">
      <p className="mb-8 text-3xl font-bold text-[var(--ctp-text)]">
        {t.menu.title}
      </p>
      <nav className="flex flex-col gap-3 text-lg">
        <MenuButton active={isActive('/')} onClick={(): void => onClick('/')}>
          <FaHome size={22} />
          {t.menu.home}
        </MenuButton>
        <MenuButton
          active={isActive('/analytics')}
          onClick={(): void => onClick('/analytics')}
        >
          <VscGraph size={22} />
          {t.menu.analytics}
        </MenuButton>
        <MenuButton
          active={isActive('/savings')}
          onClick={(): void => onClick('/savings')}
        >
          <PiPiggyBank size={22} />
          {t.menu.savings}
        </MenuButton>
        <MenuButton
          active={isActive('/goals')}
          onClick={(): void => onClick('/goals')}
        >
          <FiTarget size={22} />
          {t.goals.title}
        </MenuButton>
        <MenuButton
          active={isActive('/financings')}
          onClick={(): void => onClick('/financings')}
        >
          <PiBank size={22} />
          {t.financing.title}
        </MenuButton>
        <MenuButton
          active={isActive('/cards')}
          onClick={(): void => onClick('/cards')}
        >
          <PiCreditCard size={22} />
          {t.cards.title}
        </MenuButton>
        <MenuButton
          active={isActive('/import')}
          onClick={(): void => onClick('/import')}
        >
          <FiUpload size={22} />
          {t.menu.import}
        </MenuButton>
        <MenuButton
          active={isActive('/profile')}
          onClick={(): void => onClick('/profile')}
        >
          <CgProfile size={22} />
          {t.menu.profile}
        </MenuButton>
        <MenuButton onClick={authenticationService.logout}>
          <PiSignOutBold size={22} />
          {t.menu.signOut}
        </MenuButton>
      </nav>
      <div className="mt-auto flex flex-col gap-3 pt-8">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
