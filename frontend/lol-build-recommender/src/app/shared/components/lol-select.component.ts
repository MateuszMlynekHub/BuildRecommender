import { Component, Input, Output, EventEmitter, signal, HostListener, ElementRef, inject, ChangeDetectionStrategy } from '@angular/core';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-lol-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ls" [class.ls--open]="open()" [class.ls--sm]="size === 'sm'" [class.ls--full]="fullWidth">
      <button class="ls__trigger" (click)="toggle()" type="button"
        [attr.aria-expanded]="open()" aria-haspopup="listbox">
        <span class="ls__value">{{ selectedLabel() }}</span>
        <svg class="ls__chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          width="14" height="14" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
        </svg>
      </button>
      @if (open()) {
        <div class="ls__panel" role="listbox">
          @for (opt of options; track opt.value) {
            <div class="ls__option"
              [class.ls__option--selected]="opt.value === value"
              (click)="select(opt)" role="option"
              [attr.aria-selected]="opt.value === value">
              {{ opt.label }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ls {
      position: relative; display: inline-block; min-width: 110px;
    }
    .ls--full { display: block; width: 100%; }
    .ls--sm { min-width: 80px; }
    .ls--sm .ls__trigger { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
    .ls--sm .ls__option { padding: 0.35rem 0.6rem; font-size: 0.75rem; }

    .ls__trigger {
      width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;
      background: rgba(1, 10, 19, 0.92); border: 1px solid var(--lol-gold-4);
      color: var(--lol-gold-1); padding: 0.5rem 0.75rem; border-radius: 3px;
      font-family: 'Inter', sans-serif; font-size: 0.85rem; cursor: pointer;
      transition: border-color 0.15s;
    }
    .ls__trigger:hover, .ls--open .ls__trigger {
      border-color: var(--lol-gold-3);
    }

    .ls__value { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .ls__chevron { flex-shrink: 0; transition: transform 0.2s; color: var(--lol-gold-3); }
    .ls--open .ls__chevron { transform: rotate(180deg); }

    .ls__panel {
      position: absolute; top: calc(100% + 2px); left: 0; right: 0;
      background: rgba(9, 20, 40, 0.98); border: 1px solid var(--lol-gold-4);
      border-radius: 3px; box-shadow: 0 8px 24px rgba(0,0,0,0.7);
      z-index: 100; max-height: 240px; overflow-y: auto;
      padding: 0.2rem 0;
    }

    .ls__option {
      padding: 0.45rem 0.75rem; color: var(--lol-gold-2);
      font-size: 0.85rem; cursor: pointer;
      transition: background 0.1s, color 0.1s;
    }
    .ls__option:hover {
      background: rgba(200, 155, 60, 0.15); color: var(--lol-gold-1);
    }
    .ls__option--selected {
      background: rgba(200, 155, 60, 0.1); color: var(--lol-gold-1);
      font-weight: 600;
    }
  `],
})
export class LolSelectComponent {
  @Input() options: SelectOption[] = [];
  @Input() value = '';
  @Input() size: 'md' | 'sm' = 'md';
  @Input() fullWidth = false;
  @Output() valueChange = new EventEmitter<string>();

  private elRef = inject(ElementRef);
  readonly open = signal(false);

  readonly selectedLabel = () => {
    const opt = this.options.find(o => o.value === this.value);
    return opt?.label ?? this.value ?? '';
  };

  toggle() { this.open.set(!this.open()); }

  select(opt: SelectOption) {
    this.value = opt.value;
    this.valueChange.emit(opt.value);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    if (!this.elRef.nativeElement.contains(e.target)) {
      this.open.set(false);
    }
  }
}
