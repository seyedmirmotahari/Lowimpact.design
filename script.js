// Simple dropdown logic for menu
document.addEventListener('DOMContentLoaded', function() {
  // --- GREEN PIXEL COUNTER ---
  let isCountingPixels = false;
  let pixelCountTimeout = null;
  
  function updateGreenPixelCount() {
    const darkCountEl = document.getElementById('green-dark-count');
    const brightCountEl = document.getElementById('green-bright-count');
    const energyPercentEl = document.getElementById('green-energy-percent');
    if (!darkCountEl || !brightCountEl || !energyPercentEl) {
      return;
    }
    if (isCountingPixels) return; // Prevent multiple simultaneous counts
    
    isCountingPixels = true;
    darkCountEl.textContent = 'Counting...';
    brightCountEl.textContent = 'Counting...';
    energyPercentEl.textContent = 'Counting...';
    
    try {
      // Calculate website area (body element's visible area)
      const bodyRect = document.body.getBoundingClientRect();
      const websiteWidth = Math.min(bodyRect.width, window.innerWidth);
      const websiteHeight = Math.min(bodyRect.height, window.innerHeight);
      const totalWebsitePixels = websiteWidth * websiteHeight;
      
      // Get all visible elements
      const allElements = document.querySelectorAll('*');
      let totalDarkGreenPixels = 0;
      let totalBrightGreenPixels = 0;
      
      allElements.forEach(element => {
        // Skip if not visible
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        if (rect.right < 0 || rect.left > window.innerWidth) return;
        
        // Get computed style
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
        
        // Check background color and text color
        const bgColor = style.backgroundColor;
        const color = style.color;
        
        // Parse RGB values and check if green (dark or bright)
        const checkGreenType = (colorString) => {
          const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
          if (!match) return null;
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          // Green is dominant
          if (g > 64 && g > r + 20 && g > b + 20) {
            // Bright green: green channel > 150
            if (g > 150) return 'bright';
            // Dark green: green channel <= 150
            return 'dark';
          }
          return null;
        };
        
        const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        const area = Math.max(0, visibleWidth * visibleHeight);
        
        const bgType = checkGreenType(bgColor);
        const colorType = checkGreenType(color);
        
        // For background colors, count full area
        if (bgType === 'dark') {
          totalDarkGreenPixels += Math.floor(area);
        }
        if (bgType === 'bright') {
          totalBrightGreenPixels += Math.floor(area);
        }
        
        // For text color, estimate only ~2-3% of element area (text is very sparse)
        if (colorType === 'dark' && !bgType) {
          const textContent = element.textContent || '';
          if (textContent.trim().length > 0) {
            // Very rough estimate: text typically occupies 2-3% of its container
            totalDarkGreenPixels += Math.floor(area * 0.025);
          }
        }

        // Ensure scroll proxy is attached if other code toggles modals open later.
        (function ensureScrollProxyOnOpen() {
          try {
            const observer = new MutationObserver((mutations) => {
              for (const m of mutations) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
                const modal = m.target;
                if (!modal || !modal.classList) continue;
                if (modal.classList.contains('modal') && modal.classList.contains('open')) {
                  try { setupModalScrollProxy(modal); } catch (e) { /* ignore */ }
                }
              }
            });
            document.querySelectorAll('.modal').forEach((el) => observer.observe(el, { attributes: true, attributeFilter: ['class'] }));
          } catch (err) {
            // If MutationObserver not available, no-op.
          }
        })();
        if (colorType === 'bright' && !bgType) {
          const textContent = element.textContent || '';
          if (textContent.trim().length > 0) {
            totalBrightGreenPixels += Math.floor(area * 0.025);
          }
        }
      });
      
      // Calculate total green pixels and percentage within website area
      const totalGreenPixels = totalDarkGreenPixels + totalBrightGreenPixels;
      
      // Calculate energy usage relative to full white page (100%)
      // Offline green (#007600, g=118): 11.11% of white's energy
      // Online green (#00d200, g=210): 19.76% of white's energy
      const darkGreenCoveragePercent = (totalDarkGreenPixels / totalWebsitePixels) * 100;
      const brightGreenCoveragePercent = (totalBrightGreenPixels / totalWebsitePixels) * 100;
      
      const darkGreenEnergy = darkGreenCoveragePercent * 0.1111; // 11.11%
      const brightGreenEnergy = brightGreenCoveragePercent * 0.1976; // 19.76%
      const totalEnergyUsagePercent = (darkGreenEnergy + brightGreenEnergy).toFixed(2);
      
      darkCountEl.textContent = totalDarkGreenPixels.toLocaleString();
      brightCountEl.textContent = totalBrightGreenPixels.toLocaleString();
      energyPercentEl.textContent = totalEnergyUsagePercent;
    } catch (err) {
      darkCountEl.textContent = '?';
      brightCountEl.textContent = '?';
      energyPercentEl.textContent = '?';
      console.error('Error counting green pixels:', err);
    } finally {
      isCountingPixels = false;
    }
  }

  // Immediate update function - waits only 10ms after last change before updating (very sensitive)
  // Make it globally accessible within this scope
  window.schedulePixelCount = function() {
    if (pixelCountTimeout) clearTimeout(pixelCountTimeout);
    pixelCountTimeout = setTimeout(() => {
      updateGreenPixelCount();
    }, 10); // Very short delay for maximum sensitivity
  };

  // Run after page is fully loaded (delayed start)
  setTimeout(() => {
    updateGreenPixelCount();
  }, 1000);

  // Update on window resize
  window.addEventListener('resize', window.schedulePixelCount);

  // Watch for ALL DOM changes very aggressively
  const greenPixelObserver = new MutationObserver(window.schedulePixelCount);
  greenPixelObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  // --- PAGE WEIGHT CALCULATOR ---
  async function updatePageWeight() {
    const weightEl = document.getElementById('page-weight');
    if (!weightEl) return;
    
    try {
      // Get HTML size
      const htmlSize = new Blob([document.documentElement.outerHTML]).size;
      
      // Get CSS size
      let cssSize = 0;
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      for (const link of stylesheets) {
        try {
          const response = await fetch(link.href);
          const text = await response.text();
          cssSize += new Blob([text]).size;
        } catch (e) {
          console.warn('Could not fetch CSS:', link.href);
        }
      }
      
      // Get JavaScript size
      let jsSize = 0;
      const scripts = document.querySelectorAll('script[src]');
      for (const script of scripts) {
        try {
          const response = await fetch(script.src);
          const text = await response.text();
          jsSize += new Blob([text]).size;
        } catch (e) {
          console.warn('Could not fetch JS:', script.src);
        }
      }
      
      const totalSize = htmlSize + cssSize + jsSize;
      const sizeKB = (totalSize / 1024).toFixed(2);
      weightEl.textContent = sizeKB;
    } catch (error) {
      console.error('Error calculating page weight:', error);
      weightEl.textContent = '?';
    }
  }
  
  updatePageWeight();
  
  // Update when DOM changes (modals opening/closing, etc.)
  const pageObserver = new MutationObserver(updatePageWeight);
  pageObserver.observe(document.body, { 
    childList: true, 
    subtree: true, 
    attributes: true,
    attributeFilter: ['class', 'aria-hidden']
  });
  
  // Default location for weather/forecast requests. Update here to change city.
  const LOCATION = { lat: 38.7167, lon: -9.1333, name: 'Lisbon' };
  // Small mapping for display timezone. Add more entries if you want to switch cities.
  const TIMEZONES = {
    'Lisbon': 'Europe/Lisbon'
  };
  const dropdowns = document.querySelectorAll('li.dropdown');
  // A tiny mapping from BrightSky conditions to emoji icons (system emoji)
  const iconMap = {
    'clear': '☀︎',
    'partly-cloudy-day': '☁︎',
    'partly-cloudy-night': '☁︎',
    'cloudy': '☁︎',
    'rain': '☂︎',
    'drizzle': '☂︎',
    'thunderstorm': '☂︎',
    'snow': '❄︎',
    'fog': '🌫︎'
  };
  // Helpers used by forecast update code (ensure they're defined)
  function setForecastElement(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (text == null || text === '') ? '-' : String(text);
  }
  // Map raw condition to one of: 'sunny', 'cloudy', 'rainy'
  function condToCategory(cond) {
    if (!cond) return '-';
    const c = String(cond).toLowerCase();
    if (/rain|drizzle|thunder|snow|sleet|hail/.test(c)) return 'Rainy';
    if (/cloud|overcast|fog|mist|haze|partly/.test(c)) return 'Cloudy';
    if (/clear|sun|dry/.test(c)) return 'Sunny';
    return 'Cloudy';
  }
  // Get hour of a Date in a specified timezone (0-23)
  function getHourInTZ(date, tz) {
    try {
      return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(date));
    } catch (_) {
      return date.getHours();
    }
  }
  // Heuristics: determine if a condition string implies rain
  function isRainyCond(cond) {
    const c = String(cond || '').toLowerCase();
    return /rain|drizzle|thunder|storm|snow|sleet|hail/.test(c);
  }
  // Heuristics: determine if a condition implies cloudy
  function isCloudyCond(cond) {
    const c = String(cond || '').toLowerCase();
    return /cloud|overcast|fog|mist|haze|partly/.test(c);
  }
  // Compute a robust daily category from all items in a day
  function computeDayCategory(items) {
    if (!items || !items.length) return 'Cloudy';
    let hadRain = false;
    let cloudSum = 0;
    let cloudCount = 0;
    let cloudyHits = 0;
    items.forEach(it => {
      const cond = it.condition || it.icon || '';
      const precip = it.precipitation != null ? Number(it.precipitation) : (it.precipitation_1h != null ? Number(it.precipitation_1h) : 0);
      const precipProb = it.precipitation_probability != null ? Number(it.precipitation_probability) : null;
      if ((precipProb != null && precipProb >= 60) || (precip != null && precip > 0) || isRainyCond(cond)) {
        hadRain = true;
      }
      const cc = it.cloud_cover != null ? Number(it.cloud_cover) : null;
      if (!isNaN(cc)) { cloudSum += cc; cloudCount += 1; }
      if (isCloudyCond(cond)) cloudyHits += 1;
    });
    if (hadRain) return 'Rainy';
    const avgCloud = cloudCount > 0 ? (cloudSum / cloudCount) : null;
    if ((avgCloud != null && avgCloud >= 60) || (cloudyHits / items.length) >= 0.5) return 'Cloudy';
    return 'Sunny';
  }
  // Decide 'day' or 'night' using condition hints and hour fallback
  function determineDaypart(cond, hour) {
    const c = String(cond || '').toLowerCase();
    if (c.includes('night')) return 'night';
    if (c.includes('day')) return 'day';
    if (typeof hour === 'number') return (hour >= 6 && hour < 18) ? 'day' : 'night';
    return 'day';
  }
  // Format a final label like "sunny (day)"
  function labelCondWithDaypart(cond, dateLike, tz) {
    const hour = dateLike ? getHourInTZ(new Date(dateLike), tz) : undefined;
    const part = determineDaypart(cond, hour);
    const cat = condToCategory(cond);
    // Return only the simplified category without day/night suffix
    return `${cat}`;
  }
  // Return true if any item in the day is clear (or partly clear) during local midday
  // No midday selection rule: prefer mode (most frequent condition) per day
  // reflect the chosen LOCATION in the UI
  const locEl = document.getElementById('server-location');
  if (locEl) locEl.textContent = LOCATION.name;
  const POPUP_BREAKPOINT = 700; // px - below this we'll keep dropdowns in-flow

  // Position a dropdown so its first item text aligns directly under the trigger text
  function positionDropdown(drop) {
    const trigger = drop.querySelector('a');
    const dropdownContent = drop.querySelector('.dropdown-content');
    if (!trigger || !dropdownContent) return;
    if (window.innerWidth <= POPUP_BREAKPOINT) {
      // small view: keep in-flow
      resetDropdownStyles(drop);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const leftOffset = parseInt(drop.getAttribute('data-left-offset') || '0', 10) || 0;
    
    // Set initial styles to measure properly
    dropdownContent.style.position = 'fixed';
    dropdownContent.style.visibility = 'hidden'; // Hide during calculation
    dropdownContent.style.display = 'block';
    dropdownContent.style.top = `${rect.bottom - 1}px`;
    dropdownContent.style.left = `${rect.left + leftOffset}px`;
    dropdownContent.style.right = 'auto';
    dropdownContent.style.minWidth = `${Math.max(rect.width, 160)}px`;
    dropdownContent.style.width = 'auto';
    dropdownContent.style.zIndex = '10000';

    // Force layout calculation
    const computedWidth = dropdownContent.offsetWidth;
    let left = rect.left + leftOffset;

    // Align the visible label text exactly under the trigger's label
    try {
      const triggerLabel = trigger.querySelector('.link-label');
      const firstLabel = dropdownContent.querySelector('.link-label');
      if (triggerLabel && firstLabel) {
        const triggerLabelLeft = triggerLabel.getBoundingClientRect().left;
        const firstLabelLeft = firstLabel.getBoundingClientRect().left;
        // shift left by the label difference so text lines up
        left += (triggerLabelLeft - firstLabelLeft);
      }
    } catch (err) {
      // ignore measurement errors and fall back to base left
    }

    // Ensure it remains on-screen
    if (left + computedWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - computedWidth - 8);
    }
    
    // Apply final position and make visible
    dropdownContent.style.left = `${left}px`;
    dropdownContent.style.visibility = 'visible';
  }

  

  function resetDropdownStyles(drop) {
    const dd = drop.querySelector('.dropdown-content');
    if (!dd) return;
    // clear inline positioning so CSS rules take over
    dd.style.position = '';
    dd.style.left = '';
    dd.style.top = '';
    dd.style.right = '';
    dd.style.width = '';
    dd.style.minWidth = '';
    dd.style.zIndex = '';
    dd.style.visibility = '';
    dd.style.display = '';
    const trig = drop.querySelector('a');
    if (trig) trig.setAttribute('aria-expanded', 'false');
    // Close any open nested submenus when the dropdown closes
    const openSubmenus = drop.querySelectorAll('.has-submenu.open');
    openSubmenus.forEach(li => {
      li.classList.remove('open');
      const toggle = li.querySelector('.submenu-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Store close timers for each dropdown so we can clear them globally
  const dropdownCloseTimers = new Map();

  dropdowns.forEach(drop => {
    // Add a small delay on mouseleave so the menu doesn't close while moving to the submenu

    drop.addEventListener('mouseenter', () => {
      if (dropdownCloseTimers.has(drop)) {
        clearTimeout(dropdownCloseTimers.get(drop));
        dropdownCloseTimers.delete(drop);
      }
      // close other dropdowns for a cleaner experience
      dropdowns.forEach(d => { 
        if (d !== drop) {
          d.classList.remove('show');
          resetDropdownStyles(d);
        }
      });
      drop.classList.add('show');
      // Align position on hover as well (desktop only)
      positionDropdown(drop);
      // Update green pixel count when menu opens
      if (typeof window.schedulePixelCount === 'function') window.schedulePixelCount();
    });

    drop.addEventListener('mouseleave', () => {
      // Always auto-close on mouseleave, whether opened by click or hover
      const timer = setTimeout(() => {
        drop.classList.remove('show');
        // clear inline popup positioning when the dropdown closes
        resetDropdownStyles(drop);
        dropdownCloseTimers.delete(drop);
        // Update green pixel count when menu closes
        if (typeof window.schedulePixelCount === 'function') window.schedulePixelCount();
      }, 300); // 300ms grace period
      dropdownCloseTimers.set(drop, timer);
    });

    // Prevent default link behavior on click, but don't toggle dropdown (hover handles it)
    const trigger = drop.querySelector('a');
    trigger.addEventListener('click', function(e) {
      e.preventDefault();
      // Click does nothing - hover controls the dropdown
    });
  });

  // Dim the main menu when the user hovers over a dropdown content (so the menu items above look darker)
  const navEl = document.querySelector('nav');
  const allDropdownContents = document.querySelectorAll('.dropdown-content');
  if (navEl && allDropdownContents.length) {
    allDropdownContents.forEach(dd => {
      dd.addEventListener('mouseenter', () => navEl.classList.add('dropdown-hovering'));
      dd.addEventListener('mouseleave', () => navEl.classList.remove('dropdown-hovering'));
    });
  }

  // Close dropdowns if clicking outside
  document.addEventListener('click', function(e) {
    dropdowns.forEach(drop => {
      if (!drop.contains(e.target)) {
        drop.classList.remove('show');
        // clear any popup styling when closed by outside click
        resetDropdownStyles(drop);
      }
    });
  });

  // Toggle nested submenu under Foundational Practices
  const submenuToggles = document.querySelectorAll('.submenu-toggle');
  submenuToggles.forEach(toggle => {
    const liHas = toggle.closest('.has-submenu');
    const submenu = liHas ? liHas.querySelector('.submenu') : null;
    if (!submenu) return;
    function closeSiblingSubmenus() {
      const parentDropdown = liHas.closest('.dropdown-content');
      if (!parentDropdown) return;
      const opens = parentDropdown.querySelectorAll('.has-submenu.open');
      opens.forEach(s => {
        if (s !== liHas) {
          s.classList.remove('open');
          const t = s.querySelector('.submenu-toggle');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
    }

    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      const willOpen = !liHas.classList.contains('open');
      if (willOpen) closeSiblingSubmenus();
      const open = liHas.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // keyboard support: space or Enter toggles
    toggle.addEventListener('keydown', function(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const willOpen = !liHas.classList.contains('open');
        if (willOpen) closeSiblingSubmenus();
        const open = liHas.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });
  });


  // Generic modal handler for all menu/submenu items with data-modal
  document.querySelectorAll('.modal').forEach(modal => {
    if (!modal.dataset.hadAriaHidden) {
      modal.dataset.hadAriaHidden = modal.hasAttribute('aria-hidden') ? '1' : '0';
    }
  });

  function closeAllModals() {
    let closedAny = false;
    document.querySelectorAll('.modal.open').forEach(m => {
      if (m.dataset.hadAriaHidden === '1') {
        m.setAttribute('aria-hidden', 'true');
      } else {
        m.removeAttribute('aria-hidden');
      }
      m.classList.remove('open');
      closedAny = true;
    });
    if (closedAny) {
      document.body.classList.remove('modal-open');
    }
  }

  function bindDialogHoverState(dialog, button) {
    if (!dialog || !button || button.dataset.hoverMonitor === '1') return;
    const setState = (on) => dialog.classList.toggle('close-hover', !!on);
    ['mouseenter', 'pointerenter', 'focus'].forEach(evt => {
      button.addEventListener(evt, () => setState(true));
    });
    ['mouseleave', 'pointerleave', 'blur'].forEach(evt => {
      button.addEventListener(evt, () => setState(false));
    });
    button.dataset.hoverMonitor = '1';
  }

  function closeAllDropdowns() {
    // Clear all pending close timers
    dropdownCloseTimers.forEach((timer, drop) => {
      clearTimeout(timer);
    });
    dropdownCloseTimers.clear();
    
    // Close all dropdowns immediately and force-hide to override hover
    document.querySelectorAll('.dropdown').forEach(drop => {
      drop.classList.remove('show');
      drop.classList.add('force-hide');
      resetDropdownStyles(drop);
      
      // Remove force-hide only when mouse actually leaves the dropdown
      const removeForceHide = () => {
        drop.classList.remove('force-hide');
        drop.removeEventListener('mouseleave', removeForceHide);
      };
      drop.addEventListener('mouseleave', removeForceHide, { once: true });
    });
    // Also remove the dropdown-hovering class from the nav element
    const navEl = document.querySelector('nav');
    if (navEl) {
      navEl.classList.remove('dropdown-hovering');
    }
  }

  const modalGroups = new Map();
  const modalToGroups = new Map();
  const groupMeta = new Map();
  const modalDisplayNames = new Map();
  const modalAddresses = new Map();
  let modalGroupCounter = 0;

  function extractLinkLabel(el) {
    if (!el) return '';
    const labelChild = el.querySelector('.link-label');
    if (labelChild) return labelChild.textContent.trim();
    return (el.textContent || '').trim();
  }

  function slugifyLabel(label) {
    if (!label) return '';
    let slug = label;
    if (typeof slug.normalize === 'function') {
      slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    slug = slug.toLowerCase().replace(/&/g, 'and');
    return slug.replace(/[^a-z0-9]+/g, '');
  }

  function computeModalAddress(trigger, dropdownAncestor) {
    const segments = [];
    if (dropdownAncestor) {
      const topLabel = getDropdownLabel(dropdownAncestor);
      const topSlug = slugifyLabel(topLabel);
      if (topSlug) segments.push(topSlug);
    }
    if (dropdownAncestor) {
      const subSegments = [];
      let parent = trigger.closest('li.has-submenu');
      while (parent && dropdownAncestor.contains(parent)) {
        const toggle = parent.firstElementChild;
        const label = extractLinkLabel(toggle);
        const slug = slugifyLabel(label);
        if (slug) subSegments.unshift(slug);
        parent = parent.parentElement ? parent.parentElement.closest('li.has-submenu') : null;
      }
      if (subSegments.length) segments.push(...subSegments);
    }
    return segments.join('/');
  }

  function getDropdownLabel(dropdownEl) {
    if (!dropdownEl) return '';
    const firstChild = dropdownEl.firstElementChild;
    if (firstChild && firstChild.tagName && firstChild.tagName.toLowerCase() === 'a') {
      return extractLinkLabel(firstChild);
    }
    return extractLinkLabel(dropdownEl);
  }

  function resolveGroupId(modalId, preferredGroupId) {
    let groupId = preferredGroupId && modalGroups.has(preferredGroupId) ? preferredGroupId : preferredGroupId || '';
    if (!groupId || !modalGroups.has(groupId)) {
      const groups = modalToGroups.get(modalId);
      if (groups && groups.size) {
        const groupList = Array.from(groups);
        groupId = groupList.find(g => (modalGroups.get(g) || []).length > 1) || groupList[0];
      } else {
        groupId = null;
      }
    }
    return groupId && modalGroups.has(groupId) ? groupId : null;
  }

  document.querySelectorAll('[data-modal]').forEach(trigger => {
    const modalId = trigger.getAttribute('data-modal');
    if (!modalId) return;

    const dropdownAncestor = trigger.closest('.dropdown');
    let groupId = dropdownAncestor ? dropdownAncestor.dataset.modalGroupId : '';
    if (!groupId) {
      groupId = dropdownAncestor ? `group-${modalGroupCounter++}` : 'group-ungrouped';
      if (dropdownAncestor) {
        dropdownAncestor.dataset.modalGroupId = groupId;
      }
    }

    if (!groupMeta.has(groupId)) {
      const label = dropdownAncestor ? getDropdownLabel(dropdownAncestor) : '';
      groupMeta.set(groupId, { label });
    }

    if (!modalGroups.has(groupId)) modalGroups.set(groupId, []);
    const seq = modalGroups.get(groupId);
    if (!seq.includes(modalId)) seq.push(modalId);

    if (!modalToGroups.has(modalId)) modalToGroups.set(modalId, new Set());
    modalToGroups.get(modalId).add(groupId);

    if (!modalDisplayNames.has(modalId)) {
      modalDisplayNames.set(modalId, extractLinkLabel(trigger));
    }

    const address = computeModalAddress(trigger, dropdownAncestor);
    if (address) {
      if (!modalAddresses.has(modalId)) {
        modalAddresses.set(modalId, new Map());
      }
      const addrMap = modalAddresses.get(modalId);
      if (addrMap && !addrMap.has(groupId)) {
        addrMap.set(groupId, address);
      }
    }
  });

  function getModalTitle(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return '';
    const titleEl = modalEl.querySelector('.modal-dialog h2, .modal-dialog h3');
    return titleEl ? titleEl.textContent.trim() : '';
  }

  function updateModalBreadcrumb(modalEl, explicitGroupId) {
    const labelEl = modalEl.querySelector('.modal-nav-label');
    if (!labelEl) return;
    const resolvedGroupId = explicitGroupId || resolveGroupId(modalEl.id, modalEl.dataset.activeGroup);
    let groupLabel = '';
    if (resolvedGroupId && groupMeta.has(resolvedGroupId)) {
      groupLabel = groupMeta.get(resolvedGroupId).label || '';
    }
    let addressText = '';
    const perModalAddress = modalAddresses.get(modalEl.id);
    if (perModalAddress) {
      if (resolvedGroupId && perModalAddress.has(resolvedGroupId)) {
        addressText = perModalAddress.get(resolvedGroupId) || '';
      } else {
        const firstEntry = perModalAddress.values().next();
        if (firstEntry && !firstEntry.done) {
          addressText = firstEntry.value || '';
        }
      }
    }
    // Fallback to the modal title when a group label is unavailable so every popup shows some context text.
    const text = addressText || groupLabel || getModalTitle(modalEl.id) || '';
    labelEl.textContent = text;
    labelEl.style.display = text ? '' : 'none';
  }

  function updateModalNavState(modalEl) {
    if (!modalEl || !modalEl.dataset) return;
    let groupId = resolveGroupId(modalEl.id, modalEl.dataset.activeGroup);
    if (!groupId) return;
    modalEl.dataset.activeGroup = groupId;

    const seq = modalGroups.get(groupId);
    updateModalBreadcrumb(modalEl, groupId);
    if (!seq || seq.length <= 1) return;
    const idx = seq.indexOf(modalEl.id);
    if (idx === -1) return;
    const total = seq.length;
    const prevIdx = idx - 1;
    const nextIdx = idx + 1;
    const prevTarget = prevIdx >= 0 ? seq[prevIdx] : null;
    const nextTarget = nextIdx < total ? seq[nextIdx] : null;
    const prevBtn = modalEl.querySelector('.modal-nav.modal-prev');
    const nextBtn = modalEl.querySelector('.modal-nav.modal-next');
    if (prevBtn) {
      const hasPrev = !!prevTarget;
      if (hasPrev) {
        prevBtn.dataset.targetModal = prevTarget;
        const prevTitle = getModalTitle(prevTarget);
        if (prevTitle) {
          prevBtn.setAttribute('aria-label', `Show previous: ${prevTitle}`);
          prevBtn.setAttribute('title', prevTitle);
        } else {
          prevBtn.setAttribute('aria-label', 'Show previous item');
          prevBtn.removeAttribute('title');
        }
      } else {
        delete prevBtn.dataset.targetModal;
        prevBtn.setAttribute('aria-label', 'No previous item');
        prevBtn.removeAttribute('title');
      }
      prevBtn.disabled = !hasPrev;
      prevBtn.setAttribute('aria-disabled', hasPrev ? 'false' : 'true');
    }
    if (nextBtn) {
      const hasNext = !!nextTarget;
      if (hasNext) {
        nextBtn.dataset.targetModal = nextTarget;
        const nextTitle = getModalTitle(nextTarget);
        if (nextTitle) {
          nextBtn.setAttribute('aria-label', `Show next: ${nextTitle}`);
          nextBtn.setAttribute('title', nextTitle);
        } else {
          nextBtn.setAttribute('aria-label', 'Show next item');
          nextBtn.removeAttribute('title');
        }
      } else {
        delete nextBtn.dataset.targetModal;
        nextBtn.setAttribute('aria-label', 'No next item');
        nextBtn.removeAttribute('title');
      }
      nextBtn.disabled = !hasNext;
      nextBtn.setAttribute('aria-disabled', hasNext ? 'false' : 'true');
    }
  }

  function navigateModal(fromModal, delta) {
    if (!fromModal || !fromModal.dataset) return;
    let groupId = resolveGroupId(fromModal.id, fromModal.dataset.activeGroup);
    if (!groupId) return;
    const seq = modalGroups.get(groupId);
    if (!seq || seq.length <= 1) return;
    const currentIdx = seq.indexOf(fromModal.id);
    if (currentIdx === -1) return;
    const total = seq.length;
    const targetIdx = currentIdx + delta;
    if (targetIdx < 0 || targetIdx >= total) return;
    const targetId = seq[targetIdx];
    if (!targetId) return;
    const opened = openModalById(targetId, { groupId });
    if (opened) updateModalNavState(opened);
  }

  function attachModalNavigation(modalEl) {
    if (!modalEl || modalEl.dataset.navAttached === '1') return;
    const dialog = modalEl.querySelector('.modal-dialog');
    const closeBtn = dialog ? dialog.querySelector('.modal-close') : null;
    if (!dialog || !closeBtn) return;

    const groups = modalToGroups.get(modalEl.id);
    const hasMultiGroup = groups ? Array.from(groups).some(g => {
      const seq = modalGroups.get(g);
      return seq && seq.length > 1;
    }) : false;
    if (!hasMultiGroup) return;

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'modal-nav modal-prev';
    prevBtn.textContent = '<';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'modal-nav modal-next';
    nextBtn.textContent = '>';

    closeBtn.insertAdjacentElement('beforebegin', nextBtn);
    nextBtn.insertAdjacentElement('beforebegin', prevBtn);

    let labelEl = modalEl.querySelector('.modal-nav-label');
    if (!labelEl) {
      labelEl = document.createElement('div');
      labelEl.className = 'modal-nav-label';
      dialog.appendChild(labelEl);
    }

    prevBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      navigateModal(modalEl, -1);
    });
    nextBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      navigateModal(modalEl, 1);
    });

    bindDialogHoverState(dialog, prevBtn);
    bindDialogHoverState(dialog, nextBtn);

    modalEl.dataset.navAttached = '1';
  }

  function openModalById(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return null;
    closeAllDropdowns();
    closeAllModals();
    if (modal.dataset.hadAriaHidden === '1') {
      modal.setAttribute('aria-hidden', 'false');
    } else {
      modal.removeAttribute('aria-hidden');
    }
    modal.classList.add('open');
    document.body.classList.add('modal-open');

    const { focusClose = true, groupId: overrideGroup } = options;
    let activeGroup = resolveGroupId(modalId, overrideGroup);
    if (activeGroup) modal.dataset.activeGroup = activeGroup;
    else delete modal.dataset.activeGroup;

    const dialog = modal.querySelector('.modal-dialog');
    const closeBtn = dialog ? dialog.querySelector('.modal-close') : null;
    if (closeBtn) {
      if (focusClose !== false) {
        closeBtn.focus();
      }
      bindDialogHoverState(dialog, closeBtn);
    }

    attachModalNavigation(modal);
    updateModalNavState(modal);
    if (!activeGroup) {
      const resolved = resolveGroupId(modalId);
      if (resolved) {
        modal.dataset.activeGroup = resolved;
        updateModalBreadcrumb(modal, resolved);
      } else {
        updateModalBreadcrumb(modal, null);
      }
    }

    setupModalScrollProxy(modal);
    return modal;
  }

  modalGroups.forEach((seq) => {
    seq.forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      attachModalNavigation(modal);
      updateModalNavState(modal);
    });
  });

  document.body.addEventListener('click', function(e) {
    const modalTrigger = e.target.closest('[data-modal]');
    if (modalTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const modalId = modalTrigger.getAttribute('data-modal');
      const modalEl = document.getElementById(modalId);
      const dropdownAncestor = modalTrigger.closest('.dropdown');
      const groupId = resolveGroupId(modalId, dropdownAncestor ? dropdownAncestor.dataset.modalGroupId : '');
      openModalById(modalId, { groupId });
    }

    if (e.target.classList.contains('modal-close')) {
      e.preventDefault();
      e.stopPropagation();
      closeAllModals();
    }
  });

  // Optional: ESC key closes any open modal
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAllModals();
  });

  // Modal for Mission & Vision
  const openMission = document.getElementById('open-mission');
  const modalMission = document.getElementById('modal-mission');
  if (openMission && modalMission) {
    const dialog = modalMission.querySelector('.modal-dialog');
    const closeBtn = modalMission.querySelector('.modal-close');

    function openMissionModal() {
      const opened = openModalById('modal-mission');
      if (!opened) return;

      // Add force-hide to the About menu item to turn it dark green
      const aboutMenuItem = openMission.closest('li');
      if (aboutMenuItem) {
        aboutMenuItem.classList.add('force-hide');
        // Remove force-hide when mouse leaves the About menu item
        const removeForceHide = () => {
          aboutMenuItem.classList.remove('force-hide');
          aboutMenuItem.removeEventListener('mouseleave', removeForceHide);
        };
        aboutMenuItem.addEventListener('mouseleave', removeForceHide, { once: true });
      }
    }

    function closeMissionModal() {
      closeAllModals();
      // Do not return focus to the About link to avoid keeping it highlighted (green-active)
      if (openMission && typeof openMission.blur === 'function') {
        openMission.blur();
      }
    }

    openMission.addEventListener('click', function(e) {
      e.preventDefault();
      openMissionModal();
    });

    closeBtn.addEventListener('click', function() {
      closeMissionModal();
    });

    // Ensure hovering/focusing the X forces offline green on the dialog
    if (closeBtn && dialog) {
      const setCloseHover = (v) => dialog.classList.toggle('close-hover', !!v);
      const onEnter = () => setCloseHover(true);
      const onLeave = () => setCloseHover(false);
      closeBtn.addEventListener('mouseenter', onEnter);
      closeBtn.addEventListener('mouseleave', onLeave);
      // Pointer events for broader browser support
      closeBtn.addEventListener('pointerenter', onEnter);
      closeBtn.addEventListener('pointerleave', onLeave);
    }

    // Do NOT allow clicking outside to close or ESC to close — only the explicit close button closes this modal
  }

  // Route wheel/touch scrolling from the dialog container to its inner .modal-body
  function setupModalScrollProxy(modalEl) {
    if (!modalEl || modalEl.dataset.scrollProxy === '1') return; // already set up
    const dialog = modalEl.querySelector('.modal-dialog');
    const body = modalEl.querySelector('.modal-body');
    try {
      console.debug('setupModalScrollProxy called for', modalEl && modalEl.id, { hasDialog: !!dialog, hasBody: !!body });
    } catch (e) {}
    if (!dialog || !body) return;

    function onWheel(e) {
      // allow scrolling the body regardless of cursor being over padding/header
      const delta = e.deltaY;
      if (delta === 0) return;
      const atTop = body.scrollTop <= 0;
      const atBottom = Math.ceil(body.scrollTop + body.clientHeight) >= body.scrollHeight;
      // If we're at an edge and the user scrolls further, prevent the page from attempting to scroll
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        e.preventDefault();
      } else {
        e.preventDefault();
      }
      body.scrollTop += delta;
    }

    let touchStartY = 0;
    function onTouchStart(e) {
      if (e.touches && e.touches.length) touchStartY = e.touches[0].clientY;
    }
    function onTouchMove(e) {
      if (!e.touches || !e.touches.length) return;
      const currentY = e.touches[0].clientY;
      const delta = touchStartY - currentY; // positive means swipe up -> scroll down
      const atTop = body.scrollTop <= 0;
      const atBottom = Math.ceil(body.scrollTop + body.clientHeight) >= body.scrollHeight;
      // If at edges and swiping further out, block background scroll
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        e.preventDefault();
      } else {
        e.preventDefault();
      }
      body.scrollTop += delta;
      touchStartY = currentY;
    }

    dialog.addEventListener('wheel', onWheel, { passive: false });
    dialog.addEventListener('touchstart', onTouchStart, { passive: false });
    dialog.addEventListener('touchmove', onTouchMove, { passive: false });
    try {
      console.debug('attached scroll proxy for', modalEl.id, { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight });
    } catch (e) {}
    modalEl.dataset.scrollProxy = '1';
  }

  /* Fetch and display server-weather stats using Bright Sky API */
  async function updateServerStats() {
    try {
  const lat = LOCATION.lat;
  const lon = LOCATION.lon;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const res = await fetch(`https://api.brightsky.dev/weather?lat=${lat}&lon=${lon}&date=${dateStr}`);
      if (!res.ok) throw new Error('Weather fetch failed');
      const data = await res.json();

      const tz = TIMEZONES[LOCATION.name] || 'UTC';
      const lisbonTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(new Date());

  document.getElementById('server-time').textContent = lisbonTime;
  // Removed server-updated element to keep footer concise

      // Update weather forecast for today, tomorrow and day-after using Bright Sky data
      const weather = data.weather || [];
      // Helper: compute a label from the whole day's data
      function getDayLabel(offset) {
        const tzLocal = TIMEZONES[LOCATION.name] || 'UTC';
        const day = new Date();
        day.setDate(day.getDate() + offset);
        const dateIso = day.toISOString().slice(0, 10);
        const items = weather.filter(w => w.timestamp && w.timestamp.startsWith(dateIso));
        if (!items.length) return null;
        return computeDayCategory(items);
      }

      // Set forecast labels as e.g., "sunny (day)"
      setForecastElement('forecast-today', getDayLabel(0));
      setForecastElement('forecast-tomorrow', getDayLabel(1));
      setForecastElement('forecast-day-after', getDayLabel(2));
  // Removed forecast-updated display to simplify footer

  const hour = now.getHours(); // Local time (displayed timezone)
      const current = weather.find(w => new Date(w.timestamp).getHours() === hour) || weather[0] || null;

      if (current) {
        // Battery values now come from the RS485 /sysinfo endpoint.
        // Keep weather fetch focused on forecast only.
      }
    } catch (err) {
      console.error('Failed to update server stats', err);
    }
  }

  // Update once on load and then every N hours (configurable)
  const WEATHER_REFRESH_HOURS = 4; // fetch weather every 4 hours to reduce API calls
  const WEATHER_REFRESH_MS = WEATHER_REFRESH_HOURS * 60 * 60 * 1000;
  updateServerStats();
  setInterval(updateServerStats, WEATHER_REFRESH_MS);

  // Fetch and show a simple 3-day forecast for Lisbon (today/tomorrow/day-after)
  // Map Open-Meteo WMO weather codes to simple categories
  // See: https://open-meteo.com/en/docs
  // 0: Clear, 1-3: Mainly clear/partly cloudy, 45-48: Fog, 51-99: Precipitation
  function weatherCodeToCategory(code) {
    if (code == null) return null;
    const c = Number(code);
    if (c === 0) return 'Sunny';
    if (c >= 1 && c <= 3) return 'Cloudy'; // partly cloudy
    if (c >= 45 && c <= 48) return 'Cloudy'; // fog
    if (c >= 51 && c <= 99) return 'Rainy'; // drizzle, rain, snow, showers, thunderstorm
    return 'Cloudy'; // default
  }

  async function updateThreeDayForecast() {
    // Open-Meteo: free, no API key required
    const lat = LOCATION.lat;
    const lon = LOCATION.lon;
    const tz = encodeURIComponent(TIMEZONES[LOCATION.name] || 'UTC');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode&timezone=${tz}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Open-Meteo fetch failed');
      const data = await res.json();
      const codes = (data.daily && data.daily.weathercode) || [];
      setForecastElement('forecast-today', weatherCodeToCategory(codes[0]));
      setForecastElement('forecast-tomorrow', weatherCodeToCategory(codes[1]));
      setForecastElement('forecast-day-after', weatherCodeToCategory(codes[2]));
    } catch (err) {
      console.error('Failed to fetch Open-Meteo forecast:', err);
      // Clear values on error
      const ids = ['forecast-today','forecast-tomorrow','forecast-day-after'];
      ids.forEach((id) => setForecastElement(id, null));
    }
  }
  updateThreeDayForecast();
  // refresh forecast every WEATHER_REFRESH_HOURS hours as well
  setInterval(updateThreeDayForecast, WEATHER_REFRESH_MS);

  // Update local display time every minute and initially
  function updateLisbonTime() {
    const el = document.getElementById('server-time');
    if (!el) return;
    const now = new Date();
    const tz = TIMEZONES[LOCATION.name] || 'UTC';
    const lisbonTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(now);
    el.textContent = lisbonTime;
  }
  updateLisbonTime();
  setInterval(updateLisbonTime, 60 * 1000);

  // Make title and description highlight together when hovered or focused
  (function() {
    const headerEl = document.querySelector('header');
    const title = document.querySelector('h1');
    const desc = document.querySelector('.site-description');
    if (!headerEl) return;
    function setTitleHover(active) {
      headerEl.classList.toggle('title-hover', active);
    }
    if (title) {
      title.addEventListener('mouseenter', () => setTitleHover(true));
      title.addEventListener('mouseleave', () => setTitleHover(false));
      title.addEventListener('focus', () => setTitleHover(true));
      title.addEventListener('blur', () => setTitleHover(false));
      // Allow keyboard activation (Enter or Space) to open the About modal
      title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // Prevent page scroll on Space
          e.preventDefault();
          // If the title has a data-modal attribute, trigger a click so the
          // global modal handler (looking for [data-modal]) will open it.
          try { title.click(); } catch (err) { /* ignore */ }
        }
      });
    }
  })();

  // --- Precise text hover for 'Theoretical Framework' (hover active) ---
  (function() {
    const LABEL = 'Theoretical Framework';
    function findLabelEl() {
      const els = document.querySelectorAll('.column-box');
      for (const el of els) {
        try {
          if (String((el.textContent || '').trim()) === LABEL) return el;
        } catch (e) { continue; }
      }
      return null;
    }

    const el = findLabelEl();
    if (!el) return;
    // Make keyboard-focusable if not already
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');

    // Return true when the given client (x,y) lies over any visible text glyph
    function isPointOverVisibleText(x, y) {
      try {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let node = walker.nextNode();
        while (node) {
          const txt = String(node.textContent || '').trim();
          if (txt.length) {
            try {
              const range = document.createRange();
              range.selectNodeContents(node);
              const rects = range.getClientRects();
              for (let i = 0; i < rects.length; i++) {
                const r = rects[i];
                if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                  try { range.detach && range.detach(); } catch (e) {}
                  return true;
                }
              }
            } catch (e) {
              // ignore range errors for weird nodes
            }
          }
          node = walker.nextNode();
        }
      } catch (err) {
        // defensive: fallthrough to false
      }
      return false;
    }

    let pointerMoveHandler = null;

    function setInactive() { try { el.style.color = 'var(--green-offline)'; } catch (e) {} }
    function setActive() { try { el.style.color = 'var(--green-active)'; } catch (e) {} }

    function onPointerEnter(e) {
      // Always enable exact-text activation on pointer enter
      pointerMoveHandler = (ev) => {
        try {
          if (isPointOverVisibleText(ev.clientX, ev.clientY)) setActive(); else setInactive();
        } catch (err) { /* ignore */ }
      };
      window.addEventListener('pointermove', pointerMoveHandler, { passive: true });
      // immediate check for the entering point
      try {
        if (isPointOverVisibleText(e.clientX, e.clientY)) setActive(); else setInactive();
      } catch (err) { setInactive(); }
    }

    function onPointerLeave() {
      if (pointerMoveHandler) { window.removeEventListener('pointermove', pointerMoveHandler); pointerMoveHandler = null; }
      setInactive();
    }

    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);

    // Keyboard support: focus activates
    el.addEventListener('focus', function() { setActive(); });
    el.addEventListener('blur', function() { setInactive(); });

    // When body.class changes, don't forcibly block hover activation; only
    // ensure the label is offline when not focused or hovered.
    try {
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            if (document.activeElement !== el && !(el.matches && el.matches(':hover'))) {
              setInactive();
            }
          }
        }
      });
      if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* ignore observer errors */ }
  })();

  // Contact: heading hover highlights whole column; item hover highlights only that item
  (function() {
    const contact = document.querySelector('.contact');
    if (!contact) return;
    const itemContainers = contact.querySelectorAll('div');
    function setActive(containerEl, val) {
      if (val) {
        contact.classList.add('child-hover');
      } else {
        contact.classList.remove('child-hover');
      }
    }
    itemContainers.forEach(container => {
      container.addEventListener('mouseenter', () => setActive(container, true));
      container.addEventListener('mouseleave', () => setActive(container, false));
      container.addEventListener('focus', () => setActive(container, true));
      container.addEventListener('blur', () => setActive(container, false));
    });
    const heading = contact.querySelector('h3');
    if (heading) {
      heading.addEventListener('mouseenter', () => contact.classList.add('heading-hover'));
      heading.addEventListener('mouseleave', () => contact.classList.remove('heading-hover'));
      heading.addEventListener('focus', () => contact.classList.add('heading-hover'));
      heading.addEventListener('blur', () => contact.classList.remove('heading-hover'));
    }
  })();

  // Forecast: heading hover highlights the whole column; day hover highlights only that day
  (function() {
    const forecast = document.querySelector('.forecast');
    if (!forecast) return;
    const dayContainers = forecast.querySelectorAll('dl > div');
    function setActive(containerEl, val) {
      const dtEl = containerEl ? containerEl.querySelector('dt') : null;
      if (val) {
        forecast.classList.add('is-active-dt');
        if (dtEl) dtEl.classList.add('is-active');
        // indicate a child is hovered/focused so non-active days stay offline
        forecast.classList.add('child-hover');
      } else {
        forecast.classList.remove('is-active-dt');
        // remove the child-hover indicator when no child is active
        forecast.classList.remove('child-hover');
        if (dtEl) dtEl.classList.remove('is-active');
      }
    }
    dayContainers.forEach(container => {
      container.addEventListener('mouseenter', () => setActive(container, true));
      container.addEventListener('mouseleave', () => setActive(container, false));
      container.addEventListener('focus', () => setActive(container, true));
      container.addEventListener('blur', () => setActive(container, false));
    });
    const heading = forecast.querySelector('h3');
    if (heading) {
      heading.addEventListener('mouseenter', () => forecast.classList.add('heading-hover'));
      heading.addEventListener('mouseleave', () => forecast.classList.remove('heading-hover'));
      heading.addEventListener('focus', () => forecast.classList.add('heading-hover'));
      heading.addEventListener('blur', () => forecast.classList.remove('heading-hover'));
    }
  // Note: child-hover is managed per-child in setActive to avoid triggering it
  // when hovering the Forecast heading (which should highlight the whole column).
  })();

  // Server Stats: heading hover highlights whole column; stat hover highlights only that stat
  (function() {
    const serverStats = document.querySelector('.server-stats');
    if (!serverStats) return;
    const statContainers = serverStats.querySelectorAll('dl > div');
    function setActive(containerEl, val) {
      const dtEl = containerEl ? containerEl.querySelector('dt') : null;
      // Skip if this is the Page Weight item (has <strong> tag)
      if (dtEl && dtEl.querySelector('strong')) return;
      
      if (val) {
        serverStats.classList.add('is-active-dt');
        if (dtEl) dtEl.classList.add('is-active');
        serverStats.classList.add('child-hover');
      } else {
        serverStats.classList.remove('is-active-dt');
        serverStats.classList.remove('child-hover');
        if (dtEl) dtEl.classList.remove('is-active');
      }
    }
    statContainers.forEach(container => {
      container.addEventListener('mouseenter', () => setActive(container, true));
      container.addEventListener('mouseleave', () => setActive(container, false));
      container.addEventListener('focus', () => setActive(container, true));
      container.addEventListener('blur', () => setActive(container, false));
    });
    const heading = serverStats.querySelector('h3');
    if (heading) {
      heading.addEventListener('mouseenter', () => serverStats.classList.add('heading-hover'));
      heading.addEventListener('mouseleave', () => serverStats.classList.remove('heading-hover'));
      heading.addEventListener('focus', () => serverStats.classList.add('heading-hover'));
      heading.addEventListener('blur', () => serverStats.classList.remove('heading-hover'));
    }
  })();

  // Second Server Stats column: heading hover highlights whole column; stat hover highlights that stat + heading
  (function() {
    const allServerStats = document.querySelectorAll('.server-stats');
    if (allServerStats.length < 2) return;
    const serverStats = allServerStats[1]; // Second server-stats section
    const statContainers = serverStats.querySelectorAll('dl > div');
    function setActive(containerEl, val) {
      const dtEl = containerEl ? containerEl.querySelector('dt') : null;
      if (val) {
        serverStats.classList.add('is-active-dt');
        if (dtEl) dtEl.classList.add('is-active');
        serverStats.classList.add('child-hover');
      } else {
        serverStats.classList.remove('is-active-dt');
        serverStats.classList.remove('child-hover');
        if (dtEl) dtEl.classList.remove('is-active');
      }
    }
    statContainers.forEach(container => {
      container.addEventListener('mouseenter', () => setActive(container, true));
      container.addEventListener('mouseleave', () => setActive(container, false));
      container.addEventListener('focus', () => setActive(container, true));
      container.addEventListener('blur', () => setActive(container, false));
    });
    const heading = serverStats.querySelector('h3');
    if (heading) {
      heading.addEventListener('mouseenter', () => serverStats.classList.add('heading-hover'));
      heading.addEventListener('mouseleave', () => serverStats.classList.remove('heading-hover'));
      heading.addEventListener('focus', () => serverStats.classList.add('heading-hover'));
      heading.addEventListener('blur', () => serverStats.classList.remove('heading-hover'));
    }
  })();

  // Image variant manager: generate B&W and dithered variants client-side from a single color image
  (function() {
    const crossboxImage = document.getElementById('crossbox-image');
    const crossboxSVG = document.getElementById('crossbox-svg');
    const crossboxSize = document.getElementById('crossbox-size');
    // To avoid conflicts with inline handlers present in index.html, replace
    // the menu items with clones so any previously-attached listeners are removed.
    function replaceWithClean(id) {
      const old = document.getElementById(id);
      if (!old) return null;
      const clone = old.cloneNode(true);
      old.parentNode.replaceChild(clone, old);
      return clone;
    }

  let btnNoImage = replaceWithClean('crossbox-noimage');
  let btnDithered = replaceWithClean('crossbox-dithered');
  let btnBW = replaceWithClean('crossbox-bw');
  let btnColor = replaceWithClean('crossbox-color');
  // track the currently active key so clicks persist until another click
  // keys: 'noimage','dithered','bw','color'
  let currentActiveKey = null;
    if (!crossboxImage || !crossboxSVG || !crossboxSize) return;

    const BASE_URL = 'assets/Color.jpg';
  const cache = {}; // { color: {url, size}, bw: {url,size}, dithered: {url,size} }
  // map of exact URL (blob: or asset path) -> size in bytes
  const urlToSize = {};
    let baseImg = null;

    function clearInlineHandler(el) {
      try { if (el) el.onclick = null; } catch (e) {}
    }

    // Centralized helper to show the No Image state (used by click and hover)
    // showZero (boolean): if true, display '0 KB' in the size badge; otherwise hide the badge.
    // makeActive (boolean, optional): if true, mark No Image as the persistent active selection.
    // Hover previews call this with makeActive=false so the persistent selection isn't changed.
    function showNoImageState(showZero, makeActive) {
      try { if (crossboxEl) crossboxEl.classList.remove('dithered-active', 'bw-active', 'color-active'); } catch (e) {}
      // Only alter menu active state when explicitly requested
      try {
        if (makeActive) {
          setActiveMenuItem('noimage');
        }
      } catch (e) {}

      try { crossboxImage.style.display = 'none'; } catch (e) {}
      try { crossboxSVG.style.display = 'block'; } catch (e) {}
      try {
        if (crossboxSize) {
          if (showZero) {
            crossboxSize.textContent = '0 KB';
            crossboxSize.style.display = 'inline-block';
          } else {
            crossboxSize.textContent = '';
            crossboxSize.style.display = 'none';
          }
        }
      } catch (e) {}
    }

    // Helper to mark the active menu item and clear others
    function setActiveMenuItem(activeBtnOrKey) {
      try {
        // normalize to element and determine key
        let key = null;
        let el = null;
        if (!activeBtnOrKey) {
          key = null; el = null;
        } else if (typeof activeBtnOrKey === 'string') {
          key = activeBtnOrKey;
          if (key === 'noimage') el = btnNoImage;
          else if (key === 'dithered') el = btnDithered;
          else if (key === 'bw') el = btnBW;
          else if (key === 'color') el = btnColor;
        } else {
          el = activeBtnOrKey;
          if (el === btnNoImage) key = 'noimage';
          else if (el === btnDithered) key = 'dithered';
          else if (el === btnBW) key = 'bw';
          else if (el === btnColor) key = 'color';
        }

        [btnNoImage, btnDithered, btnBW, btnColor].forEach(b => {
          if (!b) return;
          if (b === el) {
            b.classList.add('active');
            b.classList.remove('inactive');
          } else {
            b.classList.remove('active');
            b.classList.add('inactive');
          }
        });

        currentActiveKey = key;
      } catch (e) {
        // ignore
      }
    }

    function ensureBaseImage() {
      return new Promise((resolve, reject) => {
        if (cache.color && cache.color.url && baseImg) return resolve(baseImg);
        baseImg = new Image();
        baseImg.crossOrigin = 'anonymous';
        baseImg.onload = async () => {
          try {
            // create a blob of the loaded image (so we can reuse a blob URL and know size)
            const canvas = document.createElement('canvas');
            canvas.width = baseImg.naturalWidth || baseImg.width;
            canvas.height = baseImg.naturalHeight || baseImg.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(baseImg, 0, 0);
            canvas.toBlob((blob) => {
              if (!blob) return resolve(baseImg);
              // Use blobToUrlAndCache to ensure urlToSize is populated
              blobToUrlAndCache('color', blob);
              resolve(baseImg);
            }, 'image/jpeg', 0.92);
          } catch (err) { resolve(baseImg); }
        };
        baseImg.onerror = reject;
        baseImg.src = BASE_URL;
      });
    }

    function blobToUrlAndCache(key, blob) {
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      cache[key] = { url, size: blob.size, blob };
      try { urlToSize[url] = blob.size; } catch (e) {}
      return cache[key];
    }

    const crossboxEl = crossboxImage.closest('.cross-box');
  function setImageUrl(url, sizeKB, activeClass, cacheKey) {
      // clear any active state classes first
      try {
        if (crossboxEl) {
          crossboxEl.classList.remove('dithered-active', 'bw-active', 'color-active');
        }
      } catch (e) {}

      if (activeClass && crossboxEl) {
        crossboxEl.classList.add(activeClass);
      }

      crossboxImage.src = url;
      crossboxImage.style.display = 'block';
      crossboxSVG.style.display = 'none';
      if (crossboxSize) {
        // Prefer an explicit cacheKey if provided, otherwise fall back to url->size lookup
        let finalKB = null;
        try {
          if (cacheKey && cache[cacheKey] && cache[cacheKey].size) {
            finalKB = Math.round(cache[cacheKey].size / 1024);
          } else if (urlToSize[url]) {
            finalKB = Math.round(urlToSize[url] / 1024);
          } else {
            // fallback: look for a cache entry matching this url
            for (const k in cache) {
              const e = cache[k];
              if (e && e.url === url && e.size) { finalKB = Math.round(e.size/1024); break; }
            }
          }
        } catch (err) { /* ignore */ }
        if (finalKB == null) finalKB = sizeKB || null;
        crossboxSize.textContent = finalKB ? Math.round(finalKB) + ' KB' : '';
        crossboxSize.style.display = finalKB ? 'inline-block' : 'none';
      }
    }

    function generateBWAndCache() {
      return new Promise(async (resolve, reject) => {
        if (cache.bw) return resolve(cache.bw);
        try {
          await ensureBaseImage();
          const w = baseImg.naturalWidth || baseImg.width;
          const h = baseImg.naturalHeight || baseImg.height;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(baseImg, 0, 0);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2];
            const lum = Math.round(0.2126*r + 0.7152*g + 0.0722*b);
            data[i] = data[i+1] = data[i+2] = lum;
          }
          ctx.putImageData(imgData, 0, 0);
          canvas.toBlob((blob) => {
            const entry = blobToUrlAndCache('bw', blob);
            resolve(entry);
          }, 'image/png');
        } catch (err) { reject(err); }
      });
    }

    function generateDitheredAndCache() {
      return new Promise(async (resolve, reject) => {
        try {
          await ensureBaseImage();
          // decide which cache key to use based on current backlight mode
          const isBacklight = !!(document.body && document.body.classList && document.body.classList.contains('backlight-mode'));
          const cacheKey = isBacklight ? 'dithered-backlight' : 'dithered';
          if (cache[cacheKey]) return resolve({ entry: cache[cacheKey], key: cacheKey });
          // fall through to generate and store under cacheKey
          const w = baseImg.naturalWidth || baseImg.width;
          const h = baseImg.naturalHeight || baseImg.height;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(baseImg, 0, 0);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          // Convert to grayscale first
          const lum = new Uint8ClampedArray(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const r = data[idx], g = data[idx+1], b = data[idx+2];
              lum[y*w + x] = Math.round(0.2126*r + 0.7152*g + 0.0722*b);
            }
          }
          // Ordered Bayer (8x8) dithering (no error diffusion)
          // Using an 8x8 Bayer threshold map (values 0..63). We compare each
          // pixel's luminance against a per-pixel threshold derived from the map.
          const bayer8 = [
            [0,48,12,60,3,51,15,63],
            [32,16,44,28,35,19,47,31],
            [8,56,4,52,11,59,7,55],
            [40,24,36,20,43,27,39,23],
            [2,50,14,62,1,49,13,61],
            [34,18,46,30,33,17,45,29],
            [10,58,6,54,9,57,5,53],
            [42,26,38,22,41,25,37,21]
          ];

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              const mapVal = bayer8[y & 7][x & 7]; // 0..63
              // threshold in 0..255 space: center the threshold within the cell
              const threshold = ((mapVal + 0.5) / 64) * 255;
              lum[idx] = (lum[idx] > threshold) ? 255 : 0;
            }
          }
          // Determine the active green color from CSS (fallback to #00d200)
          function parseCssColorToRgb(cssColor) {
            if (!cssColor) return [0, 210, 0];
            cssColor = cssColor.trim();
            // hex: #rrggbb or #rgb
            const hex = cssColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
            if (hex) {
              let v = hex[1];
              if (v.length === 3) v = v.split('').map(ch => ch+ch).join('');
              const r = parseInt(v.slice(0,2), 16);
              const g = parseInt(v.slice(2,4), 16);
              const b = parseInt(v.slice(4,6), 16);
              return [r,g,b];
            }
            // rgb/rgba(...) format
            const rgb = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (rgb) return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])];
            // fallback hardcoded
            return [0,210,0];
          }

          // isBacklight was determined earlier; now pick the active green color
          const cssGreen = getComputedStyle(document.documentElement).getPropertyValue('--green-active') || '#00d200';
          const greenRgb = parseCssColorToRgb(cssGreen);

          // Write back to image data: use two colors after dithering.
          // In backlight mode: white (255,255,255) and black (0,0,0).
          // Otherwise: active green and black.
          // Inverted mapping requested: swap green and black in green mode
          // - In green mode: high-tone (1) -> black, low-tone (0) -> active green
          // - In backlight mode: keep white/black as before
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const li = lum[y*w + x];
              const idx = (y * w + x) * 4;
              if (isBacklight) {
                // backlight: keep white for high-tone, black for low-tone
                if (li === 255) {
                  data[idx] = 255;
                  data[idx+1] = 255;
                  data[idx+2] = 255;
                  data[idx+3] = 255;
                } else {
                  data[idx] = data[idx+1] = data[idx+2] = 0;
                  data[idx+3] = 255;
                }
              } else {
                // green mode: invert mapping (high-tone -> black, low-tone -> green)
                if (li === 255) {
                  data[idx] = data[idx+1] = data[idx+2] = 0;
                  data[idx+3] = 255;
                } else {
                  data[idx] = greenRgb[0];
                  data[idx+1] = greenRgb[1];
                  data[idx+2] = greenRgb[2];
                  data[idx+3] = 255;
                }
              }
            }
          }
          ctx.putImageData(imgData, 0, 0);
          canvas.toBlob((blob) => {
            const entry = blobToUrlAndCache(cacheKey, blob);
            resolve({ entry: entry, key: cacheKey });
          }, 'image/png');
        } catch (err) { reject(err); }
      });
    }

    // Wire up UI: override existing inline handlers and attach our handlers
      try {
      [btnDithered, btnBW, btnColor, btnNoImage].forEach(clearInlineHandler);
      if (btnNoImage) btnNoImage.addEventListener('click', () => {
        // explicit click -> show 0 KB size
        showNoImageState(true);
          // persist selection
          setActiveMenuItem('noimage');
      });
      if (btnColor) btnColor.addEventListener('click', async () => {
        await ensureBaseImage();
        // Swap sizes: prefer to show the B&W size when Color is selected (if available)
        let sizeArg = null;
        let cacheKey = null;
        if (cache.bw && cache.bw.size) {
          sizeArg = Math.round(cache.bw.size / 1024);
          cacheKey = 'bw';
        } else if (cache.color && cache.color.size) {
          sizeArg = Math.round(cache.color.size / 1024);
          cacheKey = 'color';
        }
        if (cache.color && cache.color.url) setImageUrl(cache.color.url, sizeArg, 'color-active', cacheKey);
        else { setImageUrl(BASE_URL, null, 'color-active'); }
        setActiveMenuItem(btnColor);
      });
      if (btnBW) btnBW.addEventListener('click', async () => {
        const entry = await generateBWAndCache();
        if (entry && entry.url) {
          // Swap sizes: prefer to show the Color size when B&W is selected (if available)
          let sizeArg = null;
          let cacheKey = null;
          if (cache.color && cache.color.size) {
            sizeArg = Math.round(cache.color.size / 1024);
            cacheKey = 'color';
          } else {
            sizeArg = Math.round(entry.size / 1024);
            cacheKey = 'bw';
          }
          setImageUrl(entry.url, sizeArg, 'bw-active', cacheKey);
        }
        setActiveMenuItem(btnBW);
      });
      if (btnDithered) btnDithered.addEventListener('click', async () => {
        const res = await generateDitheredAndCache();
        if (res && res.entry && res.entry.url) setImageUrl(res.entry.url, Math.round(res.entry.size/1024), 'dithered-active', res.key);
        setActiveMenuItem(btnDithered);
      });
    } catch (err) {
      console.warn('Error wiring crossbox image manager', err);
    }

    // Ensure initial active state (default to No Image if none)
    try {
      if (!currentActiveKey) setActiveMenuItem('noimage');
    } catch (e) {}

    // Preload base image and generate variants early to reduce first-click delay
    try {
      ensureBaseImage()
        .then(() => {
          generateBWAndCache().catch(() => {});
          generateDitheredAndCache().catch(() => {});
        })
        .catch(() => {});
    } catch (e) {}

    // Solar Powered System modal: full image manager mirroring Minimize Heavy Media
    try {
      const solarImage = document.getElementById('solar-image');
      const solarSVG = document.getElementById('solar-svg');
      const solarSize = document.getElementById('solar-size');
      if (solarImage && solarSVG && solarSize) {
        const SOLAR_BASE_URL = 'assets/test.jpg';

        const sNo = document.getElementById('solar-noimage');
        const sDith = document.getElementById('solar-dithered');
        const sBW = document.getElementById('solar-bw');
        const sColor = document.getElementById('solar-color');
        const solarBox = solarImage.closest('.cross-box');
        let solarActiveKey = 'noimage';

        const solarCache = {}; // { color:{url,size,blob}, bw:{...}, dithered:{...}, dithered-backlight:{...} }
        const solarUrlToSize = {};
        let solarBaseImg = null;

        function clearSolarInline(el) { try { if (el) el.onclick = null; } catch (e) {} }

        // Label and state color helpers
        const solarLabel = document.querySelector('#modal-solar .crossbox-explanation span');
        function solarSetOfflineColors() {
          try { if (solarLabel) solarLabel.style.color = 'var(--green-offline)'; } catch (e) {}
          try { if (sNo) sNo.style.color = 'var(--green-offline)'; } catch (e) {}
        }
        function solarClearInlineColors() {
          try { if (solarLabel) solarLabel.style.color = ''; } catch (e) {}
          try { if (sNo) sNo.style.color = ''; } catch (e) {}
        }
        function solarSetActiveLabel() {
          try { if (solarLabel) solarLabel.style.color = 'var(--green-active)'; } catch (e) {}
        }

        function solarSetMenuActive(key) {
          solarActiveKey = key;
          [sNo, sDith, sBW, sColor].forEach(btn => {
            if (!btn) return;
            if ((key === 'noimage' && btn === sNo) || (key === 'dithered' && btn === sDith) || (key === 'bw' && btn === sBW) || (key === 'color' && btn === sColor)) {
              btn.classList.add('active');
              btn.classList.remove('inactive');
            } else {
              btn.classList.remove('active');
              btn.classList.add('inactive');
            }
          });
        }

        function solarSetAllInactive() {
          solarActiveKey = 'noimage';
          [sNo, sDith, sBW, sColor].forEach(btn => {
            if (!btn) return;
            btn.classList.remove('active');
            btn.classList.add('inactive');
          });
        }

        function solarShowNoImage(showZero = true, makeActive = false, forceOfflineMenu = false) {
          try { solarImage.style.display = 'none'; } catch (e) {}
          try { solarSVG.style.display = 'block'; } catch (e) {}
          try { solarImage.style.filter = 'none'; } catch (e) {}
          try {
            if (solarSize) {
              solarSize.textContent = showZero ? '0 KB' : '';
              solarSize.style.display = showZero ? 'inline-block' : 'none';
            }
          } catch (e) {}
          try {
            if (solarBox) solarBox.classList.remove('dithered-active', 'bw-active', 'color-active');
          } catch (e) {}
          // When we hide images, optionally force all menu items to offline green
          if (forceOfflineMenu) {
            solarSetAllInactive();
          } else if (makeActive) {
            solarSetMenuActive('noimage');
          }
        }

        function solarBlobToUrl(key, blob) {
          if (!blob) return null;
          const url = URL.createObjectURL(blob);
          solarCache[key] = { url, size: blob.size, blob };
          try { solarUrlToSize[url] = blob.size; } catch (e) {}
          return solarCache[key];
        }

        function ensureSolarBase() {
          return new Promise((resolve, reject) => {
            if (solarCache.color && solarCache.color.url && solarBaseImg) return resolve(solarBaseImg);
            solarBaseImg = new Image();
            solarBaseImg.crossOrigin = 'anonymous';
            solarBaseImg.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = solarBaseImg.naturalWidth || solarBaseImg.width;
                canvas.height = solarBaseImg.naturalHeight || solarBaseImg.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(solarBaseImg, 0, 0);
                canvas.toBlob((blob) => {
                  if (blob) solarBlobToUrl('color', blob);
                  resolve(solarBaseImg);
                }, 'image/jpeg', 0.92);
              } catch (err) { resolve(solarBaseImg); }
            };
            solarBaseImg.onerror = reject;
            solarBaseImg.src = SOLAR_BASE_URL;
          });
        }

        function solarSetImage(url, sizeKB, activeClass, cacheKey) {
          try {
            if (solarBox) {
              solarBox.classList.remove('dithered-active', 'bw-active', 'color-active');
              if (activeClass) solarBox.classList.add(activeClass);
            }
          } catch (e) {}
          try {
            solarImage.src = url;
            solarImage.style.display = 'block';
            solarImage.style.filter = 'none';
          } catch (e) {}
          try { solarSVG.style.display = 'none'; } catch (e) {}
          if (solarSize) {
            let finalKB = null;
            try {
              if (cacheKey && solarCache[cacheKey] && solarCache[cacheKey].size) {
                finalKB = Math.round(solarCache[cacheKey].size / 1024);
              } else if (solarUrlToSize[url]) {
                finalKB = Math.round(solarUrlToSize[url] / 1024);
              } else {
                for (const k in solarCache) {
                  const e = solarCache[k];
                  if (e && e.url === url && e.size) { finalKB = Math.round(e.size/1024); break; }
                }
              }
            } catch (err) {}
            if (finalKB == null) finalKB = sizeKB || null;
            solarSize.textContent = finalKB ? Math.round(finalKB) + ' KB' : '';
            solarSize.style.display = finalKB ? 'inline-block' : 'none';
          }
        }

        function solarGenerateBW() {
          return new Promise(async (resolve, reject) => {
            if (solarCache.bw) return resolve(solarCache.bw);
            try {
              await ensureSolarBase();
              const w = solarBaseImg.naturalWidth || solarBaseImg.width;
              const h = solarBaseImg.naturalHeight || solarBaseImg.height;
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(solarBaseImg, 0, 0);
              const imgData = ctx.getImageData(0, 0, w, h);
              const data = imgData.data;
              for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                const lum = Math.round(0.2126*r + 0.7152*g + 0.0722*b);
                data[i] = data[i+1] = data[i+2] = lum;
              }
              ctx.putImageData(imgData, 0, 0);
              canvas.toBlob((blob) => {
                const entry = solarBlobToUrl('bw', blob);
                resolve(entry);
              }, 'image/png');
            } catch (err) { reject(err); }
          });
        }

        function solarParseCssColor(cssColor) {
          if (!cssColor) return [0, 210, 0];
          cssColor = cssColor.trim();
          const hex = cssColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
          if (hex) {
            let v = hex[1];
            if (v.length === 3) v = v.split('').map(ch => ch+ch).join('');
            const r = parseInt(v.slice(0,2), 16);
            const g = parseInt(v.slice(2,4), 16);
            const b = parseInt(v.slice(4,6), 16);
            return [r,g,b];
          }
          const rgb = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
          if (rgb) return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])];
          return [0,210,0];
        }

        function solarGenerateDithered() {
          return new Promise(async (resolve, reject) => {
            try {
              await ensureSolarBase();
              const isBacklight = !!(document.body && document.body.classList && document.body.classList.contains('backlight-mode'));
              const cacheKey = isBacklight ? 'dithered-backlight' : 'dithered';
              if (solarCache[cacheKey]) return resolve({ entry: solarCache[cacheKey], key: cacheKey });
              const w = solarBaseImg.naturalWidth || solarBaseImg.width;
              const h = solarBaseImg.naturalHeight || solarBaseImg.height;
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(solarBaseImg, 0, 0);
              const imgData = ctx.getImageData(0, 0, w, h);
              const data = imgData.data;
              const lum = new Uint8ClampedArray(w * h);
              for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                  const idx = (y * w + x) * 4;
                  const r = data[idx], g = data[idx+1], b = data[idx+2];
                  lum[y*w + x] = Math.round(0.2126*r + 0.7152*g + 0.0722*b);
                }
              }
              const bayer8 = [
                [0,48,12,60,3,51,15,63],
                [32,16,44,28,35,19,47,31],
                [8,56,4,52,11,59,7,55],
                [40,24,36,20,43,27,39,23],
                [2,50,14,62,1,49,13,61],
                [34,18,46,30,33,17,45,29],
                [10,58,6,54,9,57,5,53],
                [42,26,38,22,41,25,37,21]
              ];
              for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                  const idx = y * w + x;
                  const mapVal = bayer8[y & 7][x & 7];
                  const threshold = ((mapVal + 0.5) / 64) * 255;
                  lum[idx] = (lum[idx] > threshold) ? 255 : 0;
                }
              }
              const cssGreen = getComputedStyle(document.documentElement).getPropertyValue('--green-active') || '#00d200';
              const greenRgb = solarParseCssColor(cssGreen);
              for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                  const li = lum[y*w + x];
                  const idx = (y * w + x) * 4;
                  if (isBacklight) {
                    if (li === 255) {
                      data[idx] = data[idx+1] = data[idx+2] = 255;
                      data[idx+3] = 255;
                    } else {
                      data[idx] = data[idx+1] = data[idx+2] = 0;
                      data[idx+3] = 255;
                    }
                  } else {
                    if (li === 255) {
                      data[idx] = data[idx+1] = data[idx+2] = 0;
                      data[idx+3] = 255;
                    } else {
                      data[idx] = greenRgb[0];
                      data[idx+1] = greenRgb[1];
                      data[idx+2] = greenRgb[2];
                      data[idx+3] = 255;
                    }
                  }
                }
              }
              ctx.putImageData(imgData, 0, 0);
              canvas.toBlob((blob) => {
                const entry = solarBlobToUrl(cacheKey, blob);
                resolve({ entry, key: cacheKey });
              }, 'image/png');
            } catch (err) { reject(err); }
          });
        }

        try {
          [sNo, sDith, sBW, sColor].forEach(clearSolarInline);
          if (sNo) sNo.addEventListener('click', () => { solarShowNoImage(true); solarSetMenuActive('noimage'); });
          if (sColor) sColor.addEventListener('click', async () => {
            await ensureSolarBase();
            let sizeArg = null; let cacheKey = null;
            if (solarCache.bw && solarCache.bw.size) { sizeArg = Math.round(solarCache.bw.size/1024); cacheKey = 'bw'; }
            else if (solarCache.color && solarCache.color.size) { sizeArg = Math.round(solarCache.color.size/1024); cacheKey = 'color'; }
            if (solarCache.color && solarCache.color.url) solarSetImage(solarCache.color.url, sizeArg, 'color-active', cacheKey);
            else solarSetImage(SOLAR_BASE_URL, null, 'color-active');
            solarSetMenuActive('color');
          });
          if (sBW) sBW.addEventListener('click', async () => {
            const entry = await solarGenerateBW();
            if (entry && entry.url) {
              let sizeArg = null; let cacheKey = null;
              if (solarCache.color && solarCache.color.size) { sizeArg = Math.round(solarCache.color.size/1024); cacheKey = 'color'; }
              else { sizeArg = Math.round(entry.size/1024); cacheKey = 'bw'; }
              solarSetImage(entry.url, sizeArg, 'bw-active', cacheKey);
            }
            solarSetMenuActive('bw');
          });
          if (sDith) sDith.addEventListener('click', async () => {
            const res = await solarGenerateDithered();
            if (res && res.entry && res.entry.url) solarSetImage(res.entry.url, Math.round(res.entry.size/1024), 'dithered-active', res.key);
            solarSetMenuActive('dithered');
          });
        } catch (err) { console.warn('Solar menu wiring failed', err); }

        try { solarSetMenuActive('noimage'); } catch (e) {}
        solarShowNoImage(false, false, true);

        try {
          ensureSolarBase()
            .then(() => {
              solarGenerateBW().catch(() => {});
              solarGenerateDithered().catch(() => {});
            })
            .catch(() => {});
        } catch (e) {}

        try {
          const solarBodyObs = new MutationObserver(() => {
            try {
              if (solarBox && solarBox.classList.contains('dithered-active')) {
                solarGenerateDithered().then(res => {
                  if (res && res.entry && res.entry.url) solarSetImage(res.entry.url, Math.round(res.entry.size/1024), 'dithered-active', res.key);
                }).catch(() => {});
              }
            } catch (e) {}
          });
          if (document.body) solarBodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        } catch (e) {}

        try {
          const modalSolar = document.getElementById('modal-solar');
          if (modalSolar) {
            const solarObserver = new MutationObserver(() => {
              if (modalSolar.classList.contains('open')) {
                // Match Minimize Heavy Media: default to No Image when the modal opens
                setTimeout(() => {
                  solarShowNoImage(false);
                  solarSetMenuActive('noimage');
                }, 0);
              }
            });
            solarObserver.observe(modalSolar, { attributes: true, attributeFilter: ['class'] });

            // When hovering the close (X) button, switch to No Image preview and set offline green
            try {
              const closeBtn = modalSolar.querySelector('.modal-close');
              if (closeBtn) {
                const onEnterClose = () => { try { solarShowNoImage(false, false, true); solarSetOfflineColors(); } catch(e){} };
                closeBtn.addEventListener('mouseenter', onEnterClose);
                closeBtn.addEventListener('pointerenter', onEnterClose);
                // Also support keyboard focus on the X
                closeBtn.addEventListener('focus', onEnterClose);

                // When leaving the X into the dialog, restore active-green label inside
                const onLeaveClose = (ev) => { try {
                  const solarDialog = modalSolar.querySelector('.modal-dialog');
                  const rel = ev && ev.relatedTarget;
                  if (solarDialog && rel && solarDialog.contains(rel)) { solarClearInlineColors(); solarSetActiveLabel(); }
                } catch(e){} };
                closeBtn.addEventListener('mouseleave', onLeaveClose);
                closeBtn.addEventListener('pointerleave', onLeaveClose);
                closeBtn.addEventListener('blur', onLeaveClose);
              }
            } catch (e) {}

            // Reset to No Image when cursor leaves the popup box (the dialog, not the full-screen overlay)
            const resetToNoImage = () => { try { solarShowNoImage(false, false, true); solarSetOfflineColors(); } catch (e) {} };
            try {
              const solarDialog = modalSolar.querySelector('.modal-dialog');
              if (solarDialog) {
                solarDialog.addEventListener('mouseleave', resetToNoImage);
                solarDialog.addEventListener('pointerleave', resetToNoImage);
                // Extra guard: when pointer exits the dialog to anywhere not inside it, reset
                solarDialog.addEventListener('pointerout', function(ev){
                  try {
                    const rel = ev.relatedTarget;
                    if (!rel || !(solarDialog.contains(rel))) resetToNoImage();
                  } catch (_) { /* ignore */ }
                }, { passive: true });
                // Optional: when entering dialog, clear forced offline and set active-green label
                const onEnterDialog = () => { try { solarClearInlineColors(); solarSetActiveLabel(); } catch(e){} };
                solarDialog.addEventListener('mouseenter', onEnterDialog, { passive: true });
                solarDialog.addEventListener('pointerenter', onEnterDialog, { passive: true });
              }
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Solar image manager failed', err);
    }

    // Attach hover listeners to the Tip and Why-minimize paragraphs so hovering them
    // automatically switches the preview to No Image (as requested).
    try {
      function attachHoverToPair(headingSelectorOrEl, skipClass) {
        try {
          const heading = (typeof headingSelectorOrEl === 'string') ? document.querySelector(headingSelectorOrEl) : headingSelectorOrEl;
          if (!heading) return;
          // find the next paragraph sibling that is not the heading itself (and not the optional skipClass)
          let para = null;
          let n = heading.nextSibling;
          while (n) {
            if (n.nodeType === 1 && n.tagName === 'P') {
              if (!skipClass || !n.classList || !n.classList.contains(skipClass)) { para = n; break; }
            }
            n = n.nextSibling;
          }

          // Helper to set/unset active color on both elements (heading + paragraph)
          // Both the 'Why' and the 'Tip' pairs behave the same: when active they
          // show active green; when inactive they should be offline green. We use
          // inline style for the active state and `.forced-offline` on the other
          // pair to ensure exclusivity.
          function setPairActive(on) {
            try { heading.style.color = on ? 'var(--green-active)' : ''; } catch (e) {}
            try {
              if (!para) return;
              try { para.style.color = on ? 'var(--green-active)' : ''; } catch (e) {}
            } catch (e) {}
          }

          // common enter: set colors and show No Image; ensure the other pair stays offline
          const onEnter = (e) => {
            setPairActive(true);
            // hover/focus preview should not show 0 KB; do not change persistent selection
            showNoImageState(false, false);
            try {
              // Identify both pairs: Tip pair (modal-vision) and Why pair
              const tipHeading = document.querySelector('#modal-minimize-media .modal-body p.modal-vision');
              const tipPara = tipHeading ? tipHeading.nextElementSibling : null;
              // find Why heading (p that contains a <strong> starting with 'Why minimize')
              let whyHeading = null, whyPara = null;
              try {
                const paras = Array.from(document.querySelectorAll('#modal-minimize-media .modal-body p'));
                for (let i = 0; i < paras.length; i++) {
                  const p = paras[i];
                  const s = p.querySelector && p.querySelector('strong');
                  if (s && String(s.textContent || '').trim().startsWith('Why minimize')) {
                    whyHeading = p;
                    whyPara = paras[i+1] || null;
                    break;
                  }
                }
              } catch (e) {}

              const hoveringWhy = (whyHeading && heading === whyHeading) || false;
              const hoveringTip = (tipHeading && heading === tipHeading) || false;

              // Force the OTHER pair to remain offline while this one is active
              if (hoveringWhy) {
                if (tipHeading) {
                  tipHeading.classList.add('forced-offline');
                  if (tipPara && tipPara.tagName === 'P') tipPara.classList.add('forced-offline');
                  try { tipHeading.style.color = ''; } catch (err) {}
                  try { if (tipPara) tipPara.style.color = ''; } catch (err) {}
                }
              } else if (hoveringTip) {
                if (whyHeading) {
                  whyHeading.classList.add('forced-offline');
                  if (whyPara && whyPara.tagName === 'P') whyPara.classList.add('forced-offline');
                  try { whyHeading.style.color = ''; } catch (err) {}
                  try { if (whyPara) whyPara.style.color = ''; } catch (err) {}
                }
              }
            } catch (err) { /* ignore */ }
          };

          // leave handler: clear colors unless cursor moved into preview/menu
          const onLeave = (e) => {
            const rt = e && e.relatedTarget;
            if (rt && rt.closest && (rt.closest('.cross-box') || rt.closest('.crossbox-menu'))) {
              return; // keep No Image state when moving into preview/menu
            }
            // otherwise clear after a tick to allow focus events to take precedence
              setTimeout(() => {
              // if focus moved into heading/para or into crossbox/menu, keep active
              const active = document.activeElement;
              if (active === heading || active === para) return;
              if (active && active.closest && (active.closest('.cross-box') || active.closest('.crossbox-menu'))) return;
              // Clear this pair
              setPairActive(false);
              try {
                // Identify both pairs to clear forced-offline only when neither is hovered
                const tipHeading = document.querySelector('#modal-minimize-media .modal-body p.modal-vision');
                const tipPara = tipHeading ? tipHeading.nextElementSibling : null;
                let whyHeading = null, whyPara = null;
                try {
                  const paras = Array.from(document.querySelectorAll('#modal-minimize-media .modal-body p'));
                  for (let i = 0; i < paras.length; i++) {
                    const p = paras[i];
                    const s = p.querySelector && p.querySelector('strong');
                    if (s && String(s.textContent || '').trim().startsWith('Why minimize')) {
                      whyHeading = p;
                      whyPara = paras[i+1] || null;
                      break;
                    }
                  }
                } catch (e) {}

                const tipHovered = tipHeading && (tipHeading.matches(':hover') || (tipPara && tipPara.matches(':hover')));
                const whyHovered = whyHeading && (whyHeading.matches(':hover') || (whyPara && whyPara.matches(':hover')));
                if (!tipHovered && !whyHovered) {
                  if (tipHeading) { tipHeading.classList.remove('forced-offline'); if (tipPara) tipPara.classList.remove('forced-offline'); }
                  if (whyHeading) { whyHeading.classList.remove('forced-offline'); if (whyPara) whyPara.classList.remove('forced-offline'); }
                }
                try { if (para) para.style.color = ''; } catch (err) {}
              } catch (err) { /* ignore */ }
            }, 0);
          };

          // Attach listeners
          heading.addEventListener('mouseenter', onEnter);
          heading.addEventListener('mouseleave', onLeave);
          heading.addEventListener('focus', onEnter);
          heading.addEventListener('blur', onLeave);
          if (para) {
            para.addEventListener('mouseenter', onEnter);
            para.addEventListener('mouseleave', onLeave);
            para.addEventListener('focus', onEnter);
            para.addEventListener('blur', onLeave);
          }
        } catch (e) { /* ignore attach failures */ }
      }

      // Tip: .modal-vision heading and its following paragraph
      attachHoverToPair('#modal-minimize-media .modal-body .modal-vision', null);
      // Why minimize? heading: find <p> that contains a <strong> starting with 'Why minimize'
      try {
        const paras = Array.from(document.querySelectorAll('#modal-minimize-media .modal-body p'));
        for (let i = 0; i < paras.length; i++) {
          const p = paras[i];
          const strong = p.querySelector('strong');
          if (strong && String(strong.textContent || '').trim().startsWith('Why minimize')) {
            // attach hover/focus behavior to this heading and its following paragraph
            attachHoverToPair(p, null);
            // also attach to the following paragraph if present
            if (paras[i+1]) attachHoverToPair(paras[i+1], null);
            break;
          }
        }
      } catch (e) { /* ignore */ }

      // When the mouse pointer re-enters the Minimize Heavy Media popup dialog,
      // preview No Image without changing the persistent active selection.
      try {
        const modalMin = document.getElementById('modal-minimize-media');
        if (modalMin) {
          const dialog = modalMin.querySelector('.modal-dialog');
          if (dialog) {
            const onEnterDialog = () => {
              try { showNoImageState(false, false); } catch (e) {}
            };
            dialog.addEventListener('mouseenter', onEnterDialog, { passive: true });
            dialog.addEventListener('pointerenter', onEnterDialog, { passive: true });
          }
        }
      } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore hover attach errors
    }

      // Observe body.class changes so we can regenerate dithered variant when the user toggles backlight-mode
      try {
        const bodyObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'class') {
              // If the crossbox currently shows a dithered image, regenerate the correct variant
              try {
                if (crossboxEl && crossboxEl.classList.contains('dithered-active')) {
                  generateDitheredAndCache().then((res) => {
                    if (res && res.entry && res.entry.url) setImageUrl(res.entry.url, Math.round(res.entry.size/1024), 'dithered-active', res.key);
                  }).catch(() => {});
                }
              } catch (e) { /* ignore */ }
            }
          }
        });
        if (document.body) bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      } catch (e) {
        // ignore observer errors on older browsers
      }

      // Observe the document for modals opening/closing; toggle a `popup-open` class on body
      // so CSS can selectively raise the Display Energy column only while popups are visible.
      try {
        const modalWatch = () => {
          const hasOpen = !!document.querySelector('.modal.open');
          try { document.body.classList.toggle('popup-open', !!hasOpen); } catch (e) {}
        };

        const modalObserver = new MutationObserver((mutations) => {
          // If any modal's class or child list changed, re-evaluate
          let changed = false;
          for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'class') { changed = true; break; }
            if (m.type === 'childList') { changed = true; break; }
          }
          if (changed) modalWatch();
        });

        // Observe body subtree for class and childList changes (open/close modals toggle classes)
        modalObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
        // Run once to set initial state
        modalWatch();
      } catch (e) {
        // ignore on older browsers
      }

        // --- Green active cursor: make the cursor appear green while the pointer moves ---
        (function() {
          const IDLE_MS = 700; // milliseconds to wait before hiding the active cursor
          let idleTimer = null;

          function isFormControl(el) {
            if (!el) return false;
            const tag = (el.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
            if (el.isContentEditable) return true;
            return false;
          }

          function onPointerMove(e) {
            try {
              // Keep native cursor over form controls and when interacting with them
              if (isFormControl(e.target) || (e.target.closest && e.target.closest('input,textarea,select,button,[contenteditable]'))) {
                document.body.classList.remove('cursor-moving');
                if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
                return;
              }

              // Prevent the dynamic green/hand cursor while the pointer is
              // inside the footer System Usage column — but only when NOT
              // in backlight-mode. In backlight-mode we want to allow the
              // `cursor-moving` class so the footer can show an active
              // (dark) cursor while moving and a lighter gray when idle.
              if (e.target && e.target.closest && e.target.closest('footer .system-usage') && !document.body.classList.contains('backlight-mode')) {
                document.body.classList.remove('cursor-moving');
                if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
                return;
              }

              // Add the class which enables the CSS green cursor
              document.body.classList.add('cursor-moving');
              // Reset idle timer
              if (idleTimer) clearTimeout(idleTimer);
              idleTimer = setTimeout(() => {
                document.body.classList.remove('cursor-moving');
                idleTimer = null;
              }, IDLE_MS);
            } catch (err) {
              // don't break the rest of the page if anything goes wrong
            }
          }

          // When the pointer leaves the window (mouseout with no relatedTarget), remove the active cursor
          function onPointerOut(e) {
            if (!e.relatedTarget) {
              document.body.classList.remove('cursor-moving');
              if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
            }
          }

          window.addEventListener('mousemove', onPointerMove, { passive: true });
          window.addEventListener('pointermove', onPointerMove, { passive: true });
          window.addEventListener('mouseout', onPointerOut, { passive: true });
        })();

      // --- About separator alignment ---
      // Compute the exact horizontal midpoint between the previous menu <li> and
      // the About <li>, and vertically align the separator with the h1 title.
      function alignAboutSeparator() {
        try {
          const menu = document.querySelector('nav ul.menu');
          const title = document.querySelector('header h1') || document.querySelector('h1');
          if (!menu || !title) return;

          // Find the top-level li whose label text is 'About' (first visible match)
          const topLis = Array.from(menu.children).filter(n => n.tagName === 'LI');
          let aboutLi = null;
          for (const li of topLis) {
            try {
              const label = li.querySelector('.link-label');
              if (label && String(label.textContent || '').trim().toLowerCase() === 'about') {
                aboutLi = li; break;
              }
            } catch (e) { continue; }
          }
          if (!aboutLi) return;

          // mark the About <li> so CSS can target the single left-of-About rule
          // (we'll add / remove `is-about-first` dynamically so other items that
          // happen to use the .about classname don't get the decorative line)
          try { aboutLi.classList.add('is-about-first'); } catch (e) {}

          // The separator should sit between About and the next top-level <li>
          let next = aboutLi.nextElementSibling;
          while (next && next.tagName !== 'LI') next = next.nextElementSibling;
          if (!next) return;

          // Delay adding/removing the marker classes until after measurements
          // are computed. This prevents hiding the automatic ::after fallback
          // when measurements fail or produce out-of-range values.

          const aboutRect = aboutLi.getBoundingClientRect();
          const nextRect = next.getBoundingClientRect();
          const titleRect = title.getBoundingClientRect();

          // Horizontal midpoint between About's right edge and the following item's left edge
          const midpoint = (aboutRect.right + nextRect.left) / 2;
          // compute left offset relative to the element that gets the ::before (the `next` li)
          const leftPx = Math.round(midpoint - nextRect.left);
          menu.style.setProperty('--about-sep-left', `${leftPx}px`);

          // Vertical: align separator with title center. Use an explicit pixel
          // offset rather than a percentage to avoid percent-relative
          // evaluation quirks that can cause the line to jump vertically.
          const titleCenterY = titleRect.top + (titleRect.height / 2);
          // offset in pixels relative to the top of the `next` li
          const topPx = Math.round(titleCenterY - nextRect.top);
          menu.style.setProperty('--about-sep-top', `${topPx}px`);

          // Now that we have concrete measurements, add/remove marker classes.
          // Only apply the custom midpoint separator and hide About's automatic
          // ::after when the computed left/top are finite and within a sane range
          // relative to the `next` li. This avoids accidentally hiding the
          // fallback separator when measurements are invalid (which made the
          // separator disappear).
          try {
            const saneLeft = Number.isFinite(leftPx) && leftPx > -100 && leftPx < (nextRect.width + 100);
            const saneTop = Number.isFinite(topPx) && topPx > -200 && topPx < (nextRect.height + 200);
            // Diagnostics (non-visual): print measurements so user can paste logs if the
            // separator still disappears. These messages are safe to leave in; they
            // only write to the console and don't affect styling.
            try {
              if (window && window.console && typeof window.console.debug === 'function') {
                console.debug('alignAboutSeparator:', {
                  aboutRect: {
                    top: Math.round(aboutRect.top), left: Math.round(aboutRect.left), right: Math.round(aboutRect.right), bottom: Math.round(aboutRect.bottom), width: Math.round(aboutRect.width), height: Math.round(aboutRect.height)
                  },
                  nextRect: {
                    top: Math.round(nextRect.top), left: Math.round(nextRect.left), right: Math.round(nextRect.right), bottom: Math.round(nextRect.bottom), width: Math.round(nextRect.width), height: Math.round(nextRect.height)
                  },
                  titleRect: {
                    top: Math.round(titleRect.top), left: Math.round(titleRect.left), width: Math.round(titleRect.width), height: Math.round(titleRect.height)
                  },
                  leftPx, topPx, saneLeft, saneTop
                });
              }
            } catch (e) { /* ignore logging errors */ }
            // remove markers from any others first
            topLis.forEach(li => {
              li.classList.remove('sep-before-foundations');
              li.classList.remove('no-after');
              li.classList.remove('is-about-first');
            });
            // restore the about marker (we removed it from all above)
            try { aboutLi.classList.add('is-about-first'); } catch (e) {}

            if (saneLeft && saneTop) {
              // measurements look valid -> enable custom separator. Do NOT hide
              // About's automatic ::after; leaving the fallback visible prevents
              // the separator from disappearing when measurements are flaky.
              next.classList.add('sep-before-foundations');
            } else {
              // measurements look suspicious -> ensure fallback automatic separators remain visible
              // (do not add sep-before-foundations and keep About's ::after intact)
              // nothing to do here because we already removed sep/no-after above
            }
          } catch (e) {
            // ignore class toggling errors
          }
        } catch (err) {
          // silently ignore measurement errors
        }
      }

      // Debounced resize handler
      let _alignTimeout = null;
      function scheduleAlign() {
        if (_alignTimeout) clearTimeout(_alignTimeout);
        _alignTimeout = setTimeout(() => { alignAboutSeparator(); _alignTimeout = null; }, 80);
      }

      // Run on load and on resize
      scheduleAlign();
      window.addEventListener('resize', scheduleAlign);

      // Watch for layout changes affecting header/nav and re-run alignment
      try {
        const mo = new MutationObserver(scheduleAlign);
        const watchNode = document.querySelector('header') || document.body;
        if (watchNode) mo.observe(watchNode, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
      } catch (e) {
        // ignore on older browsers
      }
      
      // Ensure footer System Usage always shows the custom cursor by applying
      // an inline, important cursor style to those elements unless the
      // page is in backlight-mode (in which case the CSS black-cursor rule
      // should apply). This is defensive: it beats remaining stylesheet
      // rules that still force the platform default.
      (function() {
        try {
          // We intentionally avoid forcing the green/custom cursor inside
          // the `footer .system-usage` area. That region must never show a
          // hand/pointer cursor. Instead, apply a neutral/back cursor there
          // (non-pointer) so the UI remains consistent.
          const GREEN_CURSOR = 'url("/assets/green-cursor.svg") 8 8, default';
          // Neutral/back (used in backlight-mode)
          const BACK_CURSOR = "url('data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22 fill=%22none%22 stroke=%22%23252525%22 stroke-width=%222%22/%3E%3C/svg%3E') 8 8, auto";
          // Offline darker green for System Usage in normal (green) mode
          const OFFLINE_CURSOR = "url('data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22 fill=%22none%22 stroke=%22%23007600%22 stroke-width=%222%22/%3E%3C/svg%3E') 8 8, auto";

          function elementsInFooter() {
            // Select the container and all its descendants so we cover dt/dd and internal spans
            const root = document.querySelector('footer .system-usage');
            if (!root) return [];
            return Array.from(root.querySelectorAll('*')).concat([root]);
          }

          function applyInlineCursor() {
            const els = elementsInFooter();
            if (!els.length) return;
            // If the page is in backlight-mode, remove any inline cursor so
            // stylesheet rules can apply. Otherwise, apply a neutral/back
            // cursor (not the green custom cursor) to prevent pointer/hand.
            if (document.body.classList.contains('backlight-mode')) {
              els.forEach(el => { try { el.style.removeProperty('cursor'); } catch(e){} });
              return;
            }
            // Apply offline green cursor to the System Usage area, but
            // special-case the CPU value so it uses the custom GREEN_CURSOR
            // (muse) instead of the offline/darker green.
            els.forEach(el => {
              try {
                if (el.id === 'system-cpu' || el.closest && el.closest('#system-cpu')) {
                  // CPU shows the custom muse/green cursor (no pointer hand)
                  el.style.setProperty('cursor', GREEN_CURSOR, 'important');
                } else {
                  el.style.setProperty('cursor', OFFLINE_CURSOR, 'important');
                }
              } catch (e) {}
            });
          }

          // Apply on load
          applyInlineCursor();

          // Re-apply when body class changes (backlight-mode toggles) or when the footer subtree changes
          const bodyObs = new MutationObserver((mutations) => { applyInlineCursor(); });
          bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

          const footerRoot = document.querySelector('footer .system-usage');
          if (footerRoot) {
            const footObs = new MutationObserver(() => applyInlineCursor());
            footObs.observe(footerRoot, { childList: true, subtree: true });
            // Also apply inline cursor immediately when the pointer enters or moves inside
            // the System Usage area. This prevents a brief flash of the platform
            // pointer/hand if the stylesheet rule wins before JS has applied the
            // inline cursor or the cursor asset is still loading.
            try {
              footerRoot.addEventListener('pointerenter', applyInlineCursor, { passive: true });
              footerRoot.addEventListener('pointermove', applyInlineCursor, { passive: true });
              footerRoot.addEventListener('pointerdown', applyInlineCursor, { passive: true });
            } catch (e) { /* ignore attach errors */ }
          }
          // Capture-phase listener on the whole document: run applyInlineCursor as
          // early as possible when the pointer moves over any element. Using
          // capture helps reduce the chance that stylesheet-driven pointer
          // changes are shown before our inline style is applied.
          try {
            document.addEventListener('pointerover', (ev) => {
              try {
                if (ev.target && ev.target.closest && ev.target.closest('footer .system-usage') && !document.body.classList.contains('backlight-mode')) {
                  applyInlineCursor();
                }
              } catch (e) {}
            }, { capture: true, passive: true });
          } catch (e) { /* ignore listener attach errors */ }
        } catch (err) {
          // defensive: if anything goes wrong we don't want to break the page
          console.warn('footer cursor helper failed', err);
        }
      })();

      // Aggressive override: dynamically inject a last-in-file stylesheet rule
      // while the pointer is inside the System Usage area so nothing can show
      // the platform hand/pointer. This is added only in non-backlight (green)
      // mode and removed immediately when the pointer leaves the area.
      (function() {
        try {
          const ROOT = 'footer .system-usage';
          const STYLE_ID = '__cursor_override_system_usage';
          const GREEN_CURSOR = "url('/assets/green-cursor.svg') 8 8, default";
          const BACK_CURSOR = "url('data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22 fill=%22none%22 stroke=%22%23252525%22 stroke-width=%222%22/%3E%3C/svg%3E') 8 8, auto";
          let styleEl = null;

          function createStyle() {
            if (styleEl) return styleEl;
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            // Very specific selector + !important to beat most stylesheet rules.
            // Use the offline green cursor for the System Usage area while
            // explicitly allowing the CPU value to use the custom GREEN_CURSOR.
            // This injected stylesheet is very specific and appended/removed
            // dynamically while the pointer is inside the area.
            styleEl.textContent = `body:not(.backlight-mode) footer .system-usage, body:not(.backlight-mode) footer .system-usage *:not(#system-cpu) { cursor: ${OFFLINE_CURSOR} !important; } body:not(.backlight-mode) footer .system-usage #system-cpu { cursor: ${GREEN_CURSOR} !important; }`;
            try { (document.head || document.documentElement).appendChild(styleEl); } catch (e) { styleEl = null; }
            return styleEl;
          }

          function removeStyle() {
            if (!styleEl) return;
            try { styleEl.parentNode && styleEl.parentNode.removeChild(styleEl); } catch (e) {}
            styleEl = null;
          }

          // Add on capture as early as possible when pointer moves over the area
          document.addEventListener('pointerover', (ev) => {
            try {
              if (document.body.classList.contains('backlight-mode')) return;
              if (ev.target && ev.target.closest && ev.target.closest(ROOT)) createStyle();
            } catch (e) {}
          }, { capture: true, passive: true });

          // Remove when pointer leaves the area (use pointerout capture and relatedTarget)
          document.addEventListener('pointerout', (ev) => {
            try {
              const related = ev.relatedTarget;
              // If the pointer moved to another element inside the same ROOT, keep the style
              if (related && related.closest && related.closest(ROOT)) return;
              removeStyle();
            } catch (e) {}
          }, { capture: true, passive: true });
        } catch (err) {
          // non-fatal
        }
      })();

      // --- Backlight-mode safety: ensure NOTHING turns green inside System Usage ---
      // When the site is in backlight-mode we aggressively force the text color
      // inside the System Usage column to a neutral gray while the pointer is
      // inside that column. This guards against JS inline color changes or
      // stylesheet interactions that might otherwise make elements green.
      (function() {
        try {
          const ROOT_SEL = 'footer .system-usage';
          const BACKLIGHT_COLOR = '#444';
          const root = document.querySelector(ROOT_SEL);
          if (!root) return;

          let pointerInside = false;

          function applyBacklightLock() {
            if (!document.body.classList.contains('backlight-mode')) return;
            // set inline !important color on root + descendants
            const els = [root].concat(Array.from(root.querySelectorAll('*')));
            els.forEach(el => {
              try { el.style.setProperty('color', BACKLIGHT_COLOR, 'important'); } catch (e) {}
            });
          }

          function removeBacklightLock() {
            // remove inline color so normal styling can resume
            const els = [root].concat(Array.from(root.querySelectorAll('*')));
            els.forEach(el => {
              try { el.style.removeProperty('color'); } catch (e) {}
            });
          }

          function onPointerEnter() {
            pointerInside = true;
            if (document.body.classList.contains('backlight-mode')) applyBacklightLock();
          }

          function onPointerLeave() {
            pointerInside = false;
            // small delay to avoid flicker when moving between child elements
            setTimeout(() => {
              if (!pointerInside) removeBacklightLock();
            }, 20);
          }

          root.addEventListener('pointerenter', onPointerEnter, { passive: true });
          root.addEventListener('pointerleave', onPointerLeave, { passive: true });
          root.addEventListener('mouseenter', onPointerEnter, { passive: true });
          root.addEventListener('mouseleave', onPointerLeave, { passive: true });

          // If backlight-mode is toggled while pointer is already inside, update immediately
          const bodyObs = new MutationObserver((mutations) => {
            for (const m of mutations) {
              if (m.type === 'attributes' && m.attributeName === 'class') {
                if (pointerInside && document.body.classList.contains('backlight-mode')) applyBacklightLock();
                else if (!document.body.classList.contains('backlight-mode')) removeBacklightLock();
              }
            }
          });
          bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        } catch (err) {
          // non-fatal
          console.warn('backlight-mode system-usage lock failed', err);
        }
      })();
      // Strong guard: whenever the site enters backlight-mode, aggressively
      // enforce neutral cursor + gray text inside the footer so no remaining
      // inline styles or late JS can make anything green. When leaving
      // backlight-mode we remove the inline locks so normal green mode works.
      (function() {
        try {
          const FOOTER_SEL = 'footer';
          const BACK_CURSOR_ACTIVE = "url('data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22 fill=%22none%22 stroke=%22%23252525%22 stroke-width=%222%22/%3E%3C/svg%3E') 8 8, auto"; // dark/black-ish
          const BACK_CURSOR_IDLE = "url('data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22 fill=%22none%22 stroke=%22%23606060%22 stroke-width=%222%22/%3E%3C/svg%3E') 8 8, auto"; // light gray
          const BACK_COLOR = '#444';

          function applyFooterBacklightLock() {
            try {
              const root = document.querySelector(FOOTER_SEL);
              if (!root) return;
              const active = document.body.classList.contains('cursor-moving');
              const els = [root].concat(Array.from(root.querySelectorAll('*')));
              els.forEach(el => {
                try {
                  // set neutral cursor depending on whether pointer is moving (active) or idle
                  el.style.setProperty('cursor', active ? BACK_CURSOR_ACTIVE : BACK_CURSOR_IDLE, 'important');
                  // force gray text to beat inline/stylesheet green rules
                  el.style.setProperty('color', BACK_COLOR, 'important');
                } catch (e) { /* ignore individual failures */ }
              });
            } catch (err) { /* ignore */ }
          }

          function removeFooterBacklightLock() {
            try {
              const root = document.querySelector(FOOTER_SEL);
              if (!root) return;
              const els = [root].concat(Array.from(root.querySelectorAll('*')));
              els.forEach(el => {
                try {
                  el.style.removeProperty('cursor');
                  el.style.removeProperty('color');
                } catch (e) { /* ignore */ }
              });
            } catch (err) { /* ignore */ }
          }

          // Watch for subtree changes inside footer and reapply locks while backlight is active
          let footerObserver = null;
          function startFooterObserver() {
            try {
              const root = document.querySelector(FOOTER_SEL);
              if (!root) return;
              if (footerObserver) footerObserver.disconnect();
              footerObserver = new MutationObserver(() => { if (document.body.classList.contains('backlight-mode')) applyFooterBacklightLock(); });
              footerObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class'] });
            } catch (e) { /* ignore */ }
          }

          // Observe body.class changes to toggle enforcement; also reapply when cursor-moving toggles
          const bodyObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
              if (m.type === 'attributes' && m.attributeName === 'class') {
                if (document.body.classList.contains('backlight-mode')) {
                  applyFooterBacklightLock();
                  startFooterObserver();
                } else {
                  // leaving backlight-mode -> remove inline locks and stop observing
                  removeFooterBacklightLock();
                  try { if (footerObserver) { footerObserver.disconnect(); footerObserver = null; } } catch(e){}
                }
              }
            }
          });
          try { bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch(e) {}

          // Apply immediately if the page is already in backlight-mode on load
          if (document.body && document.body.classList.contains('backlight-mode')) {
            applyFooterBacklightLock();
            startFooterObserver();
          }
        } catch (err) { /* non-fatal */ }
      })();

      // --- System Usage: poll /sysinfo and populate footer fields ---
      (function() {
        const POLL_MS = 2000; // 2s

        function setText(id, txt) {
          try {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = (txt == null) ? '-' : String(txt);
          } catch (e) { /* ignore */ }
        }

        async function fetchSysinfo() {
          try {
            const res = await fetch('/sysinfo', { cache: 'no-store' });
            if (!res.ok) throw new Error('Network response not ok');
            const info = await res.json();

            // Map server fields to the DOM. Use safe fallbacks.
            if (info) {
              setText('system-cpu', info.cpu_percent != null ? info.cpu_percent + '%' : '-');
              setText('system-cpu-temp', info.cpu_temp != null ? (info.cpu_temp + '°C') : '-');
              // prefer ram_percent if provided, otherwise try mem fields
              if (info.ram_percent != null) setText('system-ram', info.ram_percent + '%');
              else if (info.mem_total != null && info.mem_free != null && info.mem_used != null) setText('system-ram', info.mem_used + '%');
              else setText('system-ram', '-');

              // disk/disk_used & disk_total preferred: show value (used/total) not percent
              try {
                function humanBytes(n){
                  if (n == null || isNaN(n)) return null;
                  const kb = 1024;
                  const mb = kb * 1024;
                  const gb = mb * 1024;
                  if (n >= gb) return (n / gb).toFixed(1) + ' GB';
                  if (n >= mb) return (n / mb).toFixed(1) + ' MB';
                  if (n >= kb) return (n / kb).toFixed(1) + ' KB';
                  return n + ' B';
                }

                if (info.disk_used != null && info.disk_total != null) {
                  const used = humanBytes(Number(info.disk_used));
                  const total = humanBytes(Number(info.disk_total));
                  setText('system-mem', (used && total) ? (used + ' / ' + total) : '-');
                } else if (info.disk_total != null && info.disk_percent != null) {
                  // compute used from percent when only total+percent available
                  const usedVal = Math.round(Number(info.disk_total) * (Number(info.disk_percent) / 100));
                  const used = humanBytes(usedVal);
                  const total = humanBytes(Number(info.disk_total));
                  setText('system-mem', (used && total) ? (used + ' / ' + total) : '-');
                } else if (info.swap_used != null && info.swap_total != null) {
                  const used = humanBytes(Number(info.swap_used));
                  const total = humanBytes(Number(info.swap_total));
                  setText('system-mem', (used && total) ? (used + ' / ' + total) : '-');
                } else {
                  // Prefer not to show a percent-only value per request; show placeholder
                  setText('system-mem', '-');
                }
              } catch (e) {
                setText('system-mem', '-');
              }
            }
          } catch (err) {
            // on error show placeholders
            setText('system-cpu', '-');
            setText('system-cpu-temp', '-');
            setText('system-ram', '-');
            setText('system-mem', '-');
            // non-fatal debug log
            try { console.debug('Failed to fetch /sysinfo', err); } catch (e) {}
          }
        }

        // Start polling when DOM is ready
        try {
          fetchSysinfo();
          setInterval(fetchSysinfo, POLL_MS);
        } catch (e) {
          // ignore startup errors
        }
      })();
  })();
});