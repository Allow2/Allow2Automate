# Plugin Marketplace Integration Guide

## Installation & Setup

### 1. Install Dependencies

```bash
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
npm install react-window react-window-infinite-loader
npm install date-fns
npm install yup
npm install swr # For data fetching
```

### 2. Project Structure

```
src/
├── components/
│   └── PluginMarketplace/
│       ├── index.ts
│       ├── PluginMarketplace.tsx
│       ├── PluginCard.tsx
│       ├── PluginDetail.tsx
│       ├── PluginReview.tsx
│       ├── PluginRating.tsx
│       ├── PluginSearch.tsx
│       ├── PluginCategories.tsx
│       └── styles.ts
├── hooks/
│   ├── usePluginMarketplace.ts
│   ├── usePluginInstall.ts
│   └── usePluginReviews.ts
├── services/
│   └── plugin-marketplace.api.ts
├── types/
│   └── plugin.types.ts
├── utils/
│   ├── plugin-marketplace.handlers.ts
│   └── plugin-marketplace.helpers.ts
└── theme/
    └── marketplace-theme.ts
```

### 3. Theme Configuration

```typescript
// src/theme/marketplace-theme.ts

import { createTheme } from '@mui/material/styles';

export const marketplaceTheme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0'
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2'
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20'
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100'
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiCard: {
      defaultProps: {
        elevation: 1
      },
      styleOverrides: {
        root: {
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          }
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px'
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 6
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined'
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(0, 0, 0, 0.08)'
        }
      }
    }
  }
});
```

### 4. API Service Setup

```typescript
// src/services/plugin-marketplace.api.ts

import axios from 'axios';
import type {
  Plugin,
  PluginQueryParams,
  PluginListResponse,
  PluginReview,
  ReviewQueryParams,
  ReviewListResponse,
  ReviewSubmission,
  InstallResponse
} from '../types/plugin.types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const pluginMarketplaceAPI = {
  // Plugins
  async getPlugins(params?: PluginQueryParams): Promise<PluginListResponse> {
    const { data } = await api.get('/plugins', { params });
    return data;
  },

  async getPlugin(pluginId: string): Promise<Plugin> {
    const { data } = await api.get(`/plugins/${pluginId}`);
    return data;
  },

  async searchPlugins(query: string): Promise<Plugin[]> {
    const { data } = await api.get('/plugins/search', { params: { q: query } });
    return data;
  },

  async getFeaturedPlugins(): Promise<Plugin[]> {
    const { data } = await api.get('/plugins/featured');
    return data;
  },

  // Installation
  async installPlugin(pluginId: string, version?: string): Promise<InstallResponse> {
    const { data } = await api.post(`/plugins/${pluginId}/install`, { version });
    return data;
  },

  async uninstallPlugin(pluginId: string): Promise<void> {
    await api.delete(`/plugins/${pluginId}/install`);
  },

  async updatePlugin(pluginId: string): Promise<InstallResponse> {
    const { data } = await api.put(`/plugins/${pluginId}/install`);
    return data;
  },

  // Reviews
  async getReviews(pluginId: string, params?: ReviewQueryParams): Promise<ReviewListResponse> {
    const { data } = await api.get(`/plugins/${pluginId}/reviews`, { params });
    return data;
  },

  async submitReview(pluginId: string, review: ReviewSubmission): Promise<PluginReview> {
    const { data } = await api.post(`/plugins/${pluginId}/reviews`, review);
    return data;
  },

  async updateReview(reviewId: string, review: Partial<ReviewSubmission>): Promise<PluginReview> {
    const { data } = await api.put(`/reviews/${reviewId}`, review);
    return data;
  },

  async deleteReview(reviewId: string): Promise<void> {
    await api.delete(`/reviews/${reviewId}`);
  },

  async markReviewHelpful(reviewId: string): Promise<void> {
    await api.post(`/reviews/${reviewId}/helpful`);
  },

  // Categories & Tags
  async getCategories(): Promise<CategoryItem[]> {
    const { data } = await api.get('/plugins/categories');
    return data;
  },

  async getTags(): Promise<string[]> {
    const { data } = await api.get('/plugins/tags');
    return data;
  }
};
```

### 5. Custom Hooks

```typescript
// src/hooks/usePluginMarketplace.ts

import { useState, useCallback, useMemo } from 'react';
import type { Plugin, PluginCategory, SortOption, PluginFilters, ViewMode } from '../types/plugin.types';
import { pluginMarketplaceAPI } from '../services/plugin-marketplace.api';

export const usePluginMarketplace = (initialPlugins: Plugin[] = []) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<PluginFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set());

  // Filter and sort plugins
  const filteredPlugins = useMemo(() => {
    let result = [...initialPlugins];

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Rating filter
    if (filters.minRating) {
      result = result.filter(p => p.rating >= filters.minRating!);
    }

    // Verified filter
    if (filters.verified) {
      result = result.filter(p => p.verified);
    }

    // Installed filter
    if (filters.installed) {
      result = result.filter(p => !!p.installedVersion);
    }

    // Has updates filter
    if (filters.hasUpdates) {
      result = result.filter(p => p.hasUpdate);
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'downloads':
        result.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'updated':
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
    }

    return result;
  }, [initialPlugins, selectedCategory, searchQuery, filters, sortBy]);

  // Paginate
  const totalPages = Math.ceil(filteredPlugins.length / pageSize);
  const paginatedPlugins = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPlugins.slice(start, start + pageSize);
  }, [filteredPlugins, page, pageSize]);

  // Plugin actions
  const installPlugin = useCallback(async (pluginId: string) => {
    setInstallingPlugins(prev => new Set(prev).add(pluginId));
    try {
      await pluginMarketplaceAPI.installPlugin(pluginId);
      // Refresh plugin data
    } catch (error) {
      console.error('Failed to install plugin:', error);
      throw error;
    } finally {
      setInstallingPlugins(prev => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  }, []);

  const uninstallPlugin = useCallback(async (pluginId: string) => {
    setInstallingPlugins(prev => new Set(prev).add(pluginId));
    try {
      await pluginMarketplaceAPI.uninstallPlugin(pluginId);
      // Refresh plugin data
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      throw error;
    } finally {
      setInstallingPlugins(prev => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  }, []);

  const updatePlugin = useCallback(async (pluginId: string) => {
    setInstallingPlugins(prev => new Set(prev).add(pluginId));
    try {
      await pluginMarketplaceAPI.updatePlugin(pluginId);
      // Refresh plugin data
    } catch (error) {
      console.error('Failed to update plugin:', error);
      throw error;
    } finally {
      setInstallingPlugins(prev => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  }, []);

  return {
    // State
    viewMode,
    sortBy,
    selectedCategory,
    searchQuery,
    filters,
    page,
    pageSize,
    totalPages,
    selectedPlugin,
    filteredPlugins,
    paginatedPlugins,
    installingPlugins: Array.from(installingPlugins),

    // Actions
    setViewMode,
    setSortBy,
    setSelectedCategory,
    setSearchQuery,
    setFilters: (newFilters: Partial<PluginFilters>) => setFilters(prev => ({ ...prev, ...newFilters })),
    setPage,
    setSelectedPlugin,
    installPlugin,
    uninstallPlugin,
    updatePlugin
  };
};
```

```typescript
// src/hooks/usePluginReviews.ts

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { pluginMarketplaceAPI } from '../services/plugin-marketplace.api';
import type { PluginReview, ReviewSubmission } from '../types/plugin.types';

export const usePluginReviews = (pluginId: string | null) => {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'newest' | 'helpful' | 'rating'>('newest');

  const { data, error, mutate } = useSWR(
    pluginId ? [`/plugins/${pluginId}/reviews`, page, sortBy] : null,
    () => pluginId ? pluginMarketplaceAPI.getReviews(pluginId, { page, sortBy }) : null
  );

  const submitReview = async (review: ReviewSubmission) => {
    if (!pluginId) return;

    const newReview = await pluginMarketplaceAPI.submitReview(pluginId, review);
    mutate(); // Refresh reviews
    return newReview;
  };

  return {
    reviews: data?.reviews || [],
    total: data?.total || 0,
    averageRating: data?.averageRating || 0,
    ratingDistribution: data?.ratingDistribution || {},
    loading: !data && !error,
    error,
    page,
    setPage,
    sortBy,
    setSortBy,
    submitReview
  };
};
```

---

## Backend API Endpoints

### Required Endpoints

```typescript
// Plugin endpoints
GET    /api/plugins                    // List plugins with filters
GET    /api/plugins/:id                // Get plugin details
GET    /api/plugins/search             // Search plugins
GET    /api/plugins/featured           // Get featured plugins
POST   /api/plugins/:id/install        // Install plugin
DELETE /api/plugins/:id/install        // Uninstall plugin
PUT    /api/plugins/:id/install        // Update plugin

// Review endpoints
GET    /api/plugins/:id/reviews        // Get plugin reviews
POST   /api/plugins/:id/reviews        // Submit review
PUT    /api/reviews/:id                // Update review
DELETE /api/reviews/:id                // Delete review
POST   /api/reviews/:id/helpful        // Mark review helpful

// Category & Tag endpoints
GET    /api/plugins/categories         // Get categories
GET    /api/plugins/tags               // Get all tags
```

### Example Response Formats

```json
// GET /api/plugins
{
  "plugins": [...],
  "total": 156,
  "page": 1,
  "pageSize": 24,
  "totalPages": 7
}

// GET /api/plugins/:id
{
  "id": "plugin-123",
  "name": "Awesome Plugin",
  "description": "...",
  "version": "1.2.3",
  "rating": 4.7,
  "reviewCount": 42,
  ...
}

// POST /api/plugins/:id/install
{
  "success": true,
  "plugin": {...},
  "installedVersion": "1.2.3",
  "message": "Plugin installed successfully"
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// PluginCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PluginCard } from './PluginCard';

describe('PluginCard', () => {
  const mockPlugin = {
    id: '1',
    name: 'Test Plugin',
    description: 'Test description',
    // ... other required fields
  };

  it('renders plugin information', () => {
    render(<PluginCard plugin={mockPlugin} onClick={() => {}} />);
    expect(screen.getByText('Test Plugin')).toBeInTheDocument();
  });

  it('calls onInstall when install button clicked', () => {
    const onInstall = jest.fn();
    render(<PluginCard plugin={mockPlugin} onInstall={onInstall} />);
    fireEvent.click(screen.getByText('Install'));
    expect(onInstall).toHaveBeenCalledWith('1');
  });
});
```

### Integration Tests

```typescript
// PluginMarketplace.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { PluginMarketplace } from './PluginMarketplace';
import { pluginMarketplaceAPI } from '../services/plugin-marketplace.api';

jest.mock('../services/plugin-marketplace.api');

describe('PluginMarketplace Integration', () => {
  it('loads and displays plugins', async () => {
    const mockPlugins = [/* ... */];
    (pluginMarketplaceAPI.getPlugins as jest.Mock).mockResolvedValue({
      plugins: mockPlugins,
      total: mockPlugins.length
    });

    render(<PluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByText('Test Plugin 1')).toBeInTheDocument();
    });
  });
});
```

---

## Performance Optimization Checklist

- [ ] Implement virtual scrolling for large lists
- [ ] Lazy load plugin detail dialog
- [ ] Debounce search input (300ms)
- [ ] Memoize filtered/sorted results
- [ ] Use React.memo for PluginCard
- [ ] Implement image lazy loading
- [ ] Cache API responses with SWR
- [ ] Optimize bundle size with code splitting
- [ ] Use CDN for plugin icons/screenshots
- [ ] Implement infinite scroll pagination

---

## Accessibility Checklist

- [ ] Keyboard navigation for all interactive elements
- [ ] ARIA labels on buttons and links
- [ ] Focus management in dialogs
- [ ] Screen reader announcements for loading states
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Alt text for all images
- [ ] Semantic HTML structure
- [ ] Skip links for navigation
- [ ] Error messages announced to screen readers
- [ ] Form validation with clear error messages
