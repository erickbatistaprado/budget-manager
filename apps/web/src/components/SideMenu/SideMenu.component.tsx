'use client';

import { MenuButton, Tooltip } from '@/components';
import { IconButton } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import { authenticationService } from '@/services';
import clsx from 'clsx';
import { usePathname, useRouter } from 'next/navigation';
import type { JSX, ReactNode } from 'react';
import { AiOutlinePlus } from 'react-icons/ai';
import { FaHome } from 'react-icons/fa';
import { FiTarget, FiUpload } from 'react-icons/fi';
import { LuPanelLeftClose, LuPanelLeftOpen, LuSettings } from 'react-icons/lu';
import { PiSignOutBold, PiPiggyBank, PiBank, PiWallet } from 'react-icons/pi';
import { VscGraph, VscRobot } from 'react-icons/vsc';

interface SideMenuProps {
  onClose: () => void;
  /** Icons only, labels as tooltips: the desktop rail's compact mode. */
  compact?: boolean;
  /** Shown on the desktop rail to switch between full and compact. */
  onToggleCompact?: () => void;
  /** Adds "New transaction" at the top of the menu. */
  onNewEntry?: () => void;
}

interface Item {
  path: string;
  label: string;
  icon: ReactNode;
}

export default function SideMenu({
  onClose,
  compact = false,
  onToggleCompact,
  onNewEntry,
}: Readonly<SideMenuProps>): JSX.Element {
  const pathname: string = usePathname();
  const { push } = useRouter();
  const { t } = useI18n();

  const pages: Item[] = [
    { path: '/', label: t.menu.home, icon: <FaHome size={22} /> },
    {
      path: '/analytics',
      label: t.menu.analytics,
      icon: <VscGraph size={22} />,
    },
    {
      path: '/savings',
      label: t.menu.savings,
      icon: <PiPiggyBank size={22} />,
    },
    { path: '/goals', label: t.goals.title, icon: <FiTarget size={22} /> },
    {
      path: '/financings',
      label: t.financing.title,
      icon: <PiBank size={22} />,
    },
    { path: '/accounts', label: t.menu.accounts, icon: <PiWallet size={22} /> },
    { path: '/import', label: t.menu.import, icon: <FiUpload size={22} /> },
  ];

  function onClick(path: string): void {
    onClose();
    push(path);
  }

  function entry(
    key: string,
    label: string,
    icon: ReactNode,
    action: () => void,
    active = false
  ): JSX.Element {
    const button = (
      <MenuButton
        key={key}
        active={active}
        compact={compact}
        aria-label={compact ? label : undefined}
        onClick={action}
      >
        {icon}
        {!compact && <span className="truncate">{label}</span>}
      </MenuButton>
    );
    return compact ? (
      <Tooltip key={key} tooltip={label} placement="right">
        {button}
      </Tooltip>
    ) : (
      button
    );
  }

  return (
    <div
      className={clsx(
        'flex h-full w-full flex-col bg-[var(--ctp-mantle)]',
        onToggleCompact ? 'px-[10px] py-4' : 'max-w-xs p-6'
      )}
    >
      <div
        className={clsx(
          'mb-8 flex w-full items-center gap-2',
          onToggleCompact && 'h-11'
        )}
      >
        {onToggleCompact && compact && (
          <IconButton
            variant="quiet"
            aria-label={t.menu.expand}
            aria-expanded={false}
            onClick={onToggleCompact}
            className="group h-11 w-11 !px-0"
          >
            <VscRobot
              size={32}
              aria-hidden
              className="text-[var(--ctp-text)] group-hover:hidden group-focus-visible:hidden"
            />
            <LuPanelLeftOpen
              size={24}
              aria-hidden
              className="hidden h-8 group-hover:block group-focus-visible:block"
            />
          </IconButton>
        )}
        {onToggleCompact && !compact && (
          <>
            <span className="flex h-11 w-11 items-center justify-center">
              <VscRobot
                size={32}
                aria-hidden
                className="text-[var(--ctp-text)]"
              />
            </span>
            <IconButton
              variant="quiet"
              className="ml-auto"
              aria-label={t.menu.collapse}
              aria-expanded
              onClick={onToggleCompact}
            >
              <LuPanelLeftClose size={20} />
            </IconButton>
          </>
        )}
        {!onToggleCompact && (
          <p className="text-3xl font-bold text-[var(--ctp-text)]">
            {t.menu.title}
          </p>
        )}
      </div>
      <nav
        aria-label={t.menu.title}
        className={clsx(
          'flex w-full flex-1 flex-col gap-3 text-lg',
          compact && 'items-start'
        )}
      >
        {onNewEntry &&
          entry(
            'new-entry',
            t.header.newTransactionTooltip,
            <AiOutlinePlus size={22} />,
            onNewEntry
          )}
        {pages.map((page): JSX.Element =>
          entry(
            page.path,
            page.label,
            page.icon,
            (): void => onClick(page.path),
            pathname === page.path
          )
        )}
        <div
          className={clsx(
            'mt-auto flex flex-col gap-3 pt-6',
            compact && 'items-start'
          )}
        >
          {entry(
            '/settings',
            t.menu.settings,
            <LuSettings size={22} />,
            (): void => onClick('/settings'),
            pathname === '/settings'
          )}
          {entry(
            'sign-out',
            t.menu.signOut,
            <PiSignOutBold size={22} />,
            authenticationService.logout
          )}
        </div>
      </nav>
    </div>
  );
}
