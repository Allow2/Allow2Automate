# Plugin Marketplace Component Props Reference

## Complete TypeScript Definitions

### Plugin Data Types

```typescript
// /src/types/plugin.types.ts

export interface PluginAuthor {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  verified: boolean;
  website?: string;
  github?: string;
}

export interface PluginVersion {
  version: string;
  releaseDate: Date;
  releaseNotes: string;
  downloads: number;
  deprecated?: boolean;
  securityIssues?: string[];
}

export interface PluginRequirements {
  minVersion: string; // Minimum Automate version
  maxVersion?: string;
  dependencies?: string[]; // Other plugin IDs
  platforms?: ('windows' | 'mac' | 'linux')[];
  nodeVersion?: string;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  user: {
    name: string;
    avatar?: string;
  };
  rating: number; // 1-5
  comment: string;
  helpful: number; // Helpful votes count
  createdAt: Date;
  updatedAt: Date;
}

export interface Plugin {
  // Identity
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;

  // Author & Ownership
  author: PluginAuthor;
  contributors?: PluginAuthor[];

  // Version & Updates
  version: string;
  versions: PluginVersion[];
  installedVersion?: string;
  hasUpdate: boolean;

  // Categorization
  category: PluginCategory;
  tags: string[];

  // Media
  icon?: string;
  screenshots?: string[];
  banner?: string;

  // Metrics
  rating: number; // Average rating 0-5
  reviewCount: number;
  downloads: number;

  // Security & Trust
  verified: boolean; // Verified by Automate team
  signed: boolean; // Digitally signed
  securityAudit?: {
    date: Date;
    passed: boolean;
    issues?: string[];
  };

  // Content
  features?: string[];
  changelog?: string;
  readme?: string;

  // Technical
  requirements: PluginRequirements;
  license: string;
  repository?: string;
  homepage?: string;

  // Dates
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;

  // Installation
  downloadUrl: string;
  installScript?: string;

  // Permissions
  permissions?: string[];
}

export type PluginCategory =
  | 'all'
  | 'automation'
  | 'ui'
  | 'integration'
  | 'ai'
  | 'data'
  | 'dev-tools'
  | 'security'
  | 'productivity'
  | 'testing'
  | 'deployment';

export type SortOption =
  | 'popular'
  | 'newest'
  | 'rating'
  | 'downloads'
  | 'name'
  | 'updated';

export type ViewMode = 'grid' | 'list';

export interface PluginFilters {
  minRating?: number;
  verified?: boolean;
  installed?: boolean;
  hasUpdates?: boolean;
  categories?: PluginCategory[];
  tags?: string[];
  platforms?: string[];
}

export interface CategoryItem {
  id: PluginCategory;
  name: string;
  icon: React.ReactNode;
  count: number;
  description?: string;
}
```

### Component Props

```typescript
// /src/components/PluginMarketplace/PluginMarketplace.props.ts

import { Plugin, PluginCategory, SortOption, ViewMode, PluginFilters } from '../../types/plugin.types';

export interface PluginMarketplaceProps {
  // Data
  plugins: Plugin[];
  categories: CategoryItem[];
  featuredPlugins?: Plugin[];

  // Callbacks
  onInstall: (pluginId: string) => Promise<void>;
  onUninstall: (pluginId: string) => Promise<void>;
  onUpdate: (pluginId: string) => Promise<void>;
  onSearch: (query: string) => void;
  onFilter: (filters: PluginFilters) => void;
  onSort: (sortBy: SortOption) => void;
  onCategoryChange: (category: PluginCategory) => void;

  // Loading states
  loading?: boolean;
  installingPlugins?: string[]; // Array of plugin IDs currently installing

  // UI State
  initialViewMode?: ViewMode;
  initialSortBy?: SortOption;
  initialCategory?: PluginCategory;
  pageSize?: number;

  // Features
  enableReviews?: boolean;
  enableScreenshots?: boolean;
  showInstalledOnly?: boolean;
}

export interface PluginCardProps {
  plugin: Plugin;
  viewMode?: ViewMode;
  installing?: boolean;
  onClick: () => void;
  onInstall: (pluginId: string) => Promise<void>;
  onUninstall: (pluginId: string) => Promise<void>;
  onUpdate: (pluginId: string) => Promise<void>;
  showAuthor?: boolean;
  showStats?: boolean;
  elevation?: number;
}

export interface PluginDetailProps {
  plugin: Plugin | null;
  open: boolean;
  onClose: () => void;
  onInstall: (pluginId: string) => Promise<void>;
  onUninstall: (pluginId: string) => Promise<void>;
  onUpdate: (pluginId: string) => Promise<void>;
  installing?: boolean;
  reviews?: PluginReview[];
  onSubmitReview?: (review: Omit<PluginReview, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  loadingReviews?: boolean;
}

export interface PluginReviewProps {
  pluginId: string;
  onSubmit: (review: { rating: number; comment: string }) => Promise<void>;
  onCancel: () => void;
  initialReview?: {
    rating: number;
    comment: string;
  };
  maxLength?: number; // Default 500
}

export interface PluginRatingProps {
  value: number | null;
  onChange?: (event: React.SyntheticEvent, value: number | null) => void;
  readOnly?: boolean;
  size?: 'small' | 'medium' | 'large';
  precision?: number; // Default 0.5
  showValue?: boolean;
  max?: number; // Default 5
}

export interface PluginSearchProps {
  onSearch: (query: string) => void;
  suggestions?: string[];
  loading?: boolean;
  placeholder?: string;
  debounceMs?: number; // Default 300
}

export interface PluginCategoriesProps {
  categories: CategoryItem[];
  selected: PluginCategory | null;
  onChange: (categoryId: PluginCategory) => void;
  showCounts?: boolean;
  collapsible?: boolean;
}
```

### State Management

```typescript
// /src/hooks/usePluginMarketplace.ts

export interface UsePluginMarketplaceState {
  // Display State
  viewMode: ViewMode;
  sortBy: SortOption;
  selectedCategory: PluginCategory;
  searchQuery: string;
  filters: PluginFilters;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;

  // Selection
  selectedPlugin: string | null;

  // Data
  filteredPlugins: Plugin[];
  paginatedPlugins: Plugin[];

  // Loading
  loading: boolean;
  installingPlugins: Set<string>;
}

export interface UsePluginMarketplaceActions {
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sort: SortOption) => void;
  setCategory: (category: PluginCategory) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<PluginFilters>) => void;
  setPage: (page: number) => void;
  selectPlugin: (pluginId: string | null) => void;

  // Plugin Actions
  installPlugin: (pluginId: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  updatePlugin: (pluginId: string) => Promise<void>;

  // Reviews
  submitReview: (pluginId: string, review: { rating: number; comment: string }) => Promise<void>;
  loadReviews: (pluginId: string, page: number) => Promise<PluginReview[]>;
}

export const usePluginMarketplace = (
  plugins: Plugin[],
  options?: Partial<UsePluginMarketplaceState>
): [UsePluginMarketplaceState, UsePluginMarketplaceActions] => {
  // Implementation
};
```

### Event Handlers

```typescript
// /src/utils/plugin-marketplace.handlers.ts

export type PluginActionHandler = (pluginId: string) => Promise<void>;

export interface PluginEventHandlers {
  onInstallStart?: (pluginId: string) => void;
  onInstallProgress?: (pluginId: string, progress: number) => void;
  onInstallSuccess?: (pluginId: string, plugin: Plugin) => void;
  onInstallError?: (pluginId: string, error: Error) => void;

  onUninstallStart?: (pluginId: string) => void;
  onUninstallSuccess?: (pluginId: string) => void;
  onUninstallError?: (pluginId: string, error: Error) => void;

  onUpdateStart?: (pluginId: string) => void;
  onUpdateSuccess?: (pluginId: string, plugin: Plugin) => void;
  onUpdateError?: (pluginId: string, error: Error) => void;

  onSearchChange?: (query: string) => void;
  onFilterChange?: (filters: PluginFilters) => void;
  onSortChange?: (sortBy: SortOption) => void;
  onCategoryChange?: (category: PluginCategory) => void;
}
```

### API Service Types

```typescript
// /src/services/plugin-marketplace.api.ts

export interface PluginMarketplaceAPI {
  // Plugin Data
  getPlugins: (params?: PluginQueryParams) => Promise<PluginListResponse>;
  getPlugin: (pluginId: string) => Promise<Plugin>;
  searchPlugins: (query: string) => Promise<Plugin[]>;
  getFeaturedPlugins: () => Promise<Plugin[]>;

  // Installation
  installPlugin: (pluginId: string, version?: string) => Promise<InstallResponse>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  updatePlugin: (pluginId: string) => Promise<InstallResponse>;

  // Reviews
  getReviews: (pluginId: string, params?: ReviewQueryParams) => Promise<ReviewListResponse>;
  submitReview: (pluginId: string, review: ReviewSubmission) => Promise<PluginReview>;
  updateReview: (reviewId: string, review: Partial<ReviewSubmission>) => Promise<PluginReview>;
  deleteReview: (reviewId: string) => Promise<void>;
  markReviewHelpful: (reviewId: string) => Promise<void>;

  // Categories & Tags
  getCategories: () => Promise<CategoryItem[]>;
  getTags: () => Promise<string[]>;

  // Statistics
  getPluginStats: (pluginId: string) => Promise<PluginStats>;
}

export interface PluginQueryParams {
  category?: PluginCategory;
  tags?: string[];
  search?: string;
  sortBy?: SortOption;
  page?: number;
  pageSize?: number;
  filters?: PluginFilters;
}

export interface PluginListResponse {
  plugins: Plugin[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReviewQueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: 'newest' | 'helpful' | 'rating';
}

export interface ReviewListResponse {
  reviews: PluginReview[];
  total: number;
  page: number;
  pageSize: number;
  averageRating: number;
  ratingDistribution: {
    [key: number]: number; // 1-5 stars
  };
}

export interface ReviewSubmission {
  rating: number;
  comment: string;
}

export interface InstallResponse {
  success: boolean;
  plugin: Plugin;
  installedVersion: string;
  message?: string;
}

export interface PluginStats {
  downloads: {
    total: number;
    last7Days: number;
    last30Days: number;
  };
  ratings: {
    average: number;
    count: number;
    distribution: { [key: number]: number };
  };
  versions: {
    current: string;
    available: string[];
  };
}
```

---

## Usage Examples

### Basic Implementation

```typescript
import React from 'react';
import { PluginMarketplace } from './components/PluginMarketplace';
import { usePluginMarketplace } from './hooks/usePluginMarketplace';
import { pluginMarketplaceAPI } from './services/plugin-marketplace.api';

export const PluginMarketplacePage: React.FC = () => {
  const [plugins, setPlugins] = React.useState<Plugin[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [state, actions] = usePluginMarketplace(plugins, {
    viewMode: 'grid',
    sortBy: 'popular',
    pageSize: 24
  });

  React.useEffect(() => {
    loadPlugins();
  }, [state.searchQuery, state.selectedCategory, state.filters, state.sortBy]);

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const response = await pluginMarketplaceAPI.getPlugins({
        category: state.selectedCategory,
        search: state.searchQuery,
        filters: state.filters,
        sortBy: state.sortBy,
        page: state.page,
        pageSize: state.pageSize
      });
      setPlugins(response.plugins);
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PluginMarketplace
      plugins={state.paginatedPlugins}
      loading={loading}
      installingPlugins={Array.from(state.installingPlugins)}
      onInstall={actions.installPlugin}
      onUninstall={actions.uninstallPlugin}
      onUpdate={actions.updatePlugin}
      onSearch={actions.setSearchQuery}
      onFilter={actions.setFilters}
      onSort={actions.setSortBy}
      onCategoryChange={actions.setCategory}
    />
  );
};
```

### With Custom Event Handlers

```typescript
const eventHandlers: PluginEventHandlers = {
  onInstallSuccess: (pluginId, plugin) => {
    toast.success(`${plugin.name} installed successfully!`);
    analytics.track('plugin_installed', { pluginId, pluginName: plugin.name });
  },
  onInstallError: (pluginId, error) => {
    toast.error(`Failed to install plugin: ${error.message}`);
    analytics.track('plugin_install_error', { pluginId, error: error.message });
  },
  onSearchChange: (query) => {
    analytics.track('plugin_search', { query });
  }
};
```

---

## Validation Schemas

```typescript
import * as yup from 'yup';

export const reviewSubmissionSchema = yup.object({
  rating: yup.number()
    .required('Rating is required')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  comment: yup.string()
    .required('Comment is required')
    .min(10, 'Comment must be at least 10 characters')
    .max(500, 'Comment must be at most 500 characters')
});

export const pluginSchema = yup.object({
  id: yup.string().required(),
  name: yup.string().required().min(3).max(50),
  slug: yup.string().required().matches(/^[a-z0-9-]+$/),
  description: yup.string().required().min(20).max(200),
  version: yup.string().required().matches(/^\d+\.\d+\.\d+$/),
  category: yup.string().oneOf([
    'automation', 'ui', 'integration', 'ai', 'data',
    'dev-tools', 'security', 'productivity', 'testing', 'deployment'
  ]),
  author: yup.object({
    id: yup.string().required(),
    name: yup.string().required(),
    email: yup.string().email().required(),
    verified: yup.boolean().required()
  })
});
```
