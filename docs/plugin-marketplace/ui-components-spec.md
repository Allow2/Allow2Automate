# Plugin Marketplace UI Components Specification

## Component Architecture Overview

```
PluginMarketplace (Container)
├── PluginSearch
├── PluginCategories
├── PluginGrid/List
│   └── PluginCard (multiple)
│       ├── PluginRating
│       └── InstallButton
└── PluginDetail (Dialog)
    ├── PluginRating
    ├── PluginReview (multiple)
    └── ReviewSubmission
```

---

## 1. PluginMarketplace.js - Main Container

### Purpose
Main marketplace view orchestrating search, filters, and plugin display.

### Props
```javascript
{
  // Data
  plugins: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    author: PropTypes.shape({
      name: PropTypes.string.isRequired,
      avatar: PropTypes.string,
      verified: PropTypes.bool
    }).isRequired,
    version: PropTypes.string.isRequired,
    category: PropTypes.string.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string),
    rating: PropTypes.number,
    downloads: PropTypes.number,
    icon: PropTypes.string,
    screenshots: PropTypes.arrayOf(PropTypes.string),
    verified: PropTypes.bool,
    signed: PropTypes.bool,
    installedVersion: PropTypes.string, // null if not installed
    hasUpdate: PropTypes.bool
  })),

  // Callbacks
  onInstall: PropTypes.func.isRequired, // (pluginId) => Promise<void>
  onUninstall: PropTypes.func.isRequired, // (pluginId) => Promise<void>
  onUpdate: PropTypes.func.isRequired, // (pluginId) => Promise<void>
  onSearch: PropTypes.func.isRequired, // (query) => void
  onFilter: PropTypes.func.isRequired, // (filters) => void

  // Loading states
  loading: PropTypes.bool,
  installingPlugins: PropTypes.arrayOf(PropTypes.string) // Array of plugin IDs
}
```

### State
```javascript
{
  viewMode: 'grid' | 'list', // Display mode
  sortBy: 'popular' | 'newest' | 'rating' | 'downloads' | 'name',
  selectedCategory: string | null,
  searchQuery: string,
  filters: {
    minRating: number,
    verified: boolean,
    installed: boolean,
    hasUpdates: boolean
  },
  selectedPlugin: string | null, // For detail dialog
  page: number,
  pageSize: number
}
```

### Layout
```jsx
<Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
  {/* Header */}
  <AppBar position="static" elevation={1}>
    <Toolbar>
      <Typography variant="h6">Plugin Marketplace</Typography>
      <Box sx={{ flexGrow: 1 }} />
      <ToggleButtonGroup value={viewMode}>
        <ToggleButton value="grid"><GridViewIcon /></ToggleButton>
        <ToggleButton value="list"><ViewListIcon /></ToggleButton>
      </ToggleButtonGroup>
    </Toolbar>
  </AppBar>

  {/* Search Bar */}
  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
    <PluginSearch onSearch={handleSearch} />
  </Box>

  {/* Main Content */}
  <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
    {/* Sidebar */}
    <Drawer variant="permanent" sx={{ width: 280 }}>
      <PluginCategories
        selected={selectedCategory}
        onChange={handleCategoryChange}
      />

      {/* Filters */}
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Filters</Typography>
        <FormGroup>
          <FormControlLabel
            control={<Checkbox checked={filters.verified} />}
            label="Verified Only"
          />
          <FormControlLabel
            control={<Checkbox checked={filters.installed} />}
            label="Installed"
          />
          <FormControlLabel
            control={<Checkbox checked={filters.hasUpdates} />}
            label="Has Updates"
          />
        </FormGroup>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption">Minimum Rating</Typography>
          <Rating value={filters.minRating} onChange={handleRatingFilter} />
        </Box>
      </Box>
    </Drawer>

    {/* Plugin Grid/List */}
    <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
      {/* Sort Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {filteredPlugins.length} plugins found
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Sort by</InputLabel>
          <Select value={sortBy} onChange={handleSortChange}>
            <MenuItem value="popular">Most Popular</MenuItem>
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="rating">Highest Rated</MenuItem>
            <MenuItem value="downloads">Most Downloaded</MenuItem>
            <MenuItem value="name">Name (A-Z)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Plugin Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {paginatedPlugins.map(plugin => (
            <Grid item xs={12} sm={viewMode === 'grid' ? 6 : 12} md={viewMode === 'grid' ? 4 : 12} key={plugin.id}>
              <PluginCard
                plugin={plugin}
                viewMode={viewMode}
                installing={installingPlugins.includes(plugin.id)}
                onInstall={onInstall}
                onUninstall={onUninstall}
                onUpdate={onUpdate}
                onClick={() => setSelectedPlugin(plugin.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={handlePageChange}
          color="primary"
        />
      </Box>
    </Box>
  </Box>

  {/* Detail Dialog */}
  <PluginDetail
    plugin={selectedPluginData}
    open={!!selectedPlugin}
    onClose={() => setSelectedPlugin(null)}
    onInstall={onInstall}
    onUninstall={onUninstall}
    onUpdate={onUpdate}
    installing={installingPlugins.includes(selectedPlugin)}
  />
</Box>
```

---

## 2. PluginCard.js - Plugin Listing Card

### Purpose
Display plugin summary with quick actions.

### Props
```javascript
{
  plugin: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    author: PropTypes.object.isRequired,
    version: PropTypes.string.isRequired,
    rating: PropTypes.number,
    downloads: PropTypes.number,
    icon: PropTypes.string,
    verified: PropTypes.bool,
    signed: PropTypes.bool,
    installedVersion: PropTypes.string,
    hasUpdate: PropTypes.bool
  }).isRequired,
  viewMode: PropTypes.oneOf(['grid', 'list']),
  installing: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  onInstall: PropTypes.func.isRequired,
  onUninstall: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired
}
```

### Layout - Grid Mode
```jsx
<Card
  sx={{
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    '&:hover': { boxShadow: 4 }
  }}
  onClick={onClick}
>
  <CardHeader
    avatar={
      <Avatar src={plugin.icon} alt={plugin.name}>
        {plugin.name[0]}
      </Avatar>
    }
    action={
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {plugin.verified && (
          <Tooltip title="Verified Plugin">
            <VerifiedIcon color="primary" fontSize="small" />
          </Tooltip>
        )}
        {plugin.signed && (
          <Tooltip title="Digitally Signed">
            <SecurityIcon color="success" fontSize="small" />
          </Tooltip>
        )}
      </Box>
    }
    title={
      <Typography variant="subtitle1" noWrap fontWeight="medium">
        {plugin.name}
      </Typography>
    }
    subheader={
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Avatar sx={{ width: 16, height: 16 }} src={plugin.author.avatar} />
        <Typography variant="caption">{plugin.author.name}</Typography>
        {plugin.author.verified && <VerifiedUserIcon sx={{ fontSize: 14 }} color="primary" />}
      </Box>
    }
  />

  <CardContent sx={{ flexGrow: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    }}>
      {plugin.description}
    </Typography>

    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      <PluginRating value={plugin.rating} readOnly size="small" />
      <Chip
        label={`${plugin.downloads?.toLocaleString()} downloads`}
        size="small"
        variant="outlined"
      />
    </Box>
  </CardContent>

  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
    <Typography variant="caption" color="text.secondary">
      v{plugin.version}
    </Typography>

    {plugin.installedVersion ? (
      plugin.hasUpdate ? (
        <Button
          size="small"
          variant="contained"
          startIcon={<UpdateIcon />}
          disabled={installing}
          onClick={(e) => { e.stopPropagation(); onUpdate(plugin.id); }}
        >
          Update
        </Button>
      ) : (
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          disabled={installing}
          onClick={(e) => { e.stopPropagation(); onUninstall(plugin.id); }}
        >
          Uninstall
        </Button>
      )
    ) : (
      <Button
        size="small"
        variant="contained"
        startIcon={installing ? <CircularProgress size={16} /> : <DownloadIcon />}
        disabled={installing}
        onClick={(e) => { e.stopPropagation(); onInstall(plugin.id); }}
      >
        Install
      </Button>
    )}
  </CardActions>
</Card>
```

### Layout - List Mode
```jsx
<Card sx={{ display: 'flex', cursor: 'pointer', '&:hover': { boxShadow: 2 } }} onClick={onClick}>
  <Avatar
    src={plugin.icon}
    variant="rounded"
    sx={{ width: 80, height: 80, m: 2 }}
  >
    {plugin.name[0]}
  </Avatar>

  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <CardContent sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">{plugin.name}</Typography>
            {plugin.verified && <VerifiedIcon color="primary" fontSize="small" />}
            {plugin.signed && <SecurityIcon color="success" fontSize="small" />}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Avatar sx={{ width: 20, height: 20 }} src={plugin.author.avatar} />
            <Typography variant="body2" color="text.secondary">
              {plugin.author.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              • v{plugin.version}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {plugin.description}
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
            <PluginRating value={plugin.rating} readOnly size="small" />
            <Typography variant="caption">
              {plugin.downloads?.toLocaleString()} downloads
            </Typography>
          </Box>
        </Box>

        <Box sx={{ ml: 2 }}>
          {plugin.installedVersion ? (
            plugin.hasUpdate ? (
              <Button
                variant="contained"
                startIcon={<UpdateIcon />}
                disabled={installing}
                onClick={(e) => { e.stopPropagation(); onUpdate(plugin.id); }}
              >
                Update Available
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                disabled={installing}
                onClick={(e) => { e.stopPropagation(); onUninstall(plugin.id); }}
              >
                Uninstall
              </Button>
            )
          ) : (
            <Button
              variant="contained"
              startIcon={installing ? <CircularProgress size={16} /> : <DownloadIcon />}
              disabled={installing}
              onClick={(e) => { e.stopPropagation(); onInstall(plugin.id); }}
            >
              Install
            </Button>
          )}
        </Box>
      </Box>
    </CardContent>
  </Box>
</Card>
```

---

## 3. PluginDetail.js - Detailed Plugin View

### Purpose
Full plugin information dialog with reviews, screenshots, and installation.

### Props
```javascript
{
  plugin: PropTypes.object, // Full plugin object with extended data
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onInstall: PropTypes.func.isRequired,
  onUninstall: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  installing: PropTypes.bool
}
```

### State
```javascript
{
  activeTab: 'overview' | 'reviews' | 'versions' | 'changelog',
  selectedScreenshot: number,
  reviews: Array<Review>,
  reviewsPage: number,
  showReviewForm: boolean,
  userReview: Review | null
}
```

### Layout
```jsx
<Dialog
  open={open}
  onClose={onClose}
  maxWidth="md"
  fullWidth
  PaperProps={{ sx: { height: '90vh' } }}
>
  <DialogTitle>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Avatar
          src={plugin.icon}
          variant="rounded"
          sx={{ width: 64, height: 64 }}
        >
          {plugin.name[0]}
        </Avatar>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5">{plugin.name}</Typography>
            {plugin.verified && (
              <Tooltip title="Verified by Automate Team">
                <VerifiedIcon color="primary" />
              </Tooltip>
            )}
            {plugin.signed && (
              <Tooltip title="Digitally Signed">
                <SecurityIcon color="success" />
              </Tooltip>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Avatar sx={{ width: 24, height: 24 }} src={plugin.author.avatar} />
            <Typography variant="body2" color="text.secondary">
              {plugin.author.name}
            </Typography>
            {plugin.author.verified && <VerifiedUserIcon fontSize="small" color="primary" />}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
            <PluginRating value={plugin.rating} readOnly />
            <Typography variant="body2">
              ({plugin.reviewCount} reviews)
            </Typography>
            <Chip label={`${plugin.downloads?.toLocaleString()} downloads`} size="small" />
          </Box>
        </Box>
      </Box>

      <IconButton onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </Box>
  </DialogTitle>

  <DialogContent dividers>
    <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tab label="Overview" value="overview" />
      <Tab label={`Reviews (${plugin.reviewCount})`} value="reviews" />
      <Tab label="Version History" value="versions" />
      <Tab label="Changelog" value="changelog" />
    </Tabs>

    {/* Overview Tab */}
    {activeTab === 'overview' && (
      <Box sx={{ py: 2 }}>
        {/* Screenshots */}
        {plugin.screenshots?.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>Screenshots</Typography>
            <Box sx={{ position: 'relative' }}>
              <img
                src={plugin.screenshots[selectedScreenshot]}
                alt={`Screenshot ${selectedScreenshot + 1}`}
                style={{ width: '100%', borderRadius: 8 }}
              />
              {plugin.screenshots.length > 1 && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'center' }}>
                  {plugin.screenshots.map((screenshot, idx) => (
                    <Box
                      key={idx}
                      onClick={() => setSelectedScreenshot(idx)}
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: 1,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: 2,
                        borderColor: idx === selectedScreenshot ? 'primary.main' : 'transparent',
                        opacity: idx === selectedScreenshot ? 1 : 0.6
                      }}
                    >
                      <img src={screenshot} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Description */}
        <Typography variant="h6" gutterBottom>Description</Typography>
        <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
          {plugin.longDescription || plugin.description}
        </Typography>

        {/* Features */}
        {plugin.features?.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>Features</Typography>
            <List>
              {plugin.features.map((feature, idx) => (
                <ListItem key={idx}>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary={feature} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Details Grid */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Details</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Version</Typography>
              <Typography variant="body2">{plugin.version}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Last Updated</Typography>
              <Typography variant="body2">{formatDate(plugin.updatedAt)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Category</Typography>
              <Typography variant="body2">{plugin.category}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">License</Typography>
              <Typography variant="body2">{plugin.license || 'MIT'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Tags</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                {plugin.tags?.map(tag => (
                  <Chip key={tag} label={tag} size="small" />
                ))}
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* System Requirements */}
        {plugin.requirements && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>System Requirements</Typography>
            <Alert severity="info">
              <Typography variant="body2">
                Requires Automate {plugin.requirements.minVersion} or higher
              </Typography>
              {plugin.requirements.dependencies && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Dependencies: {plugin.requirements.dependencies.join(', ')}
                </Typography>
              )}
            </Alert>
          </Box>
        )}
      </Box>
    )}

    {/* Reviews Tab */}
    {activeTab === 'reviews' && (
      <Box sx={{ py: 2 }}>
        {/* Review Summary */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3">{plugin.rating?.toFixed(1)}</Typography>
                <PluginRating value={plugin.rating} readOnly />
                <Typography variant="body2" color="text.secondary">
                  {plugin.reviewCount} reviews
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              {[5, 4, 3, 2, 1].map(stars => (
                <Box key={stars} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" sx={{ width: 20 }}>{stars}</Typography>
                  <StarIcon fontSize="small" />
                  <LinearProgress
                    variant="determinate"
                    value={getStarPercentage(stars)}
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="caption" sx={{ width: 40 }}>
                    {getStarCount(stars)}
                  </Typography>
                </Box>
              ))}
            </Grid>
          </Grid>
        </Paper>

        {/* Write Review Button */}
        {!userReview && plugin.installedVersion && (
          <Button
            variant="outlined"
            fullWidth
            sx={{ mb: 2 }}
            onClick={() => setShowReviewForm(true)}
          >
            Write a Review
          </Button>
        )}

        {/* Review Form */}
        {showReviewForm && (
          <PluginReview
            pluginId={plugin.id}
            onSubmit={handleReviewSubmit}
            onCancel={() => setShowReviewForm(false)}
          />
        )}

        {/* Reviews List */}
        <Stack spacing={2}>
          {reviews.map(review => (
            <Paper key={review.id} sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={review.user.avatar} sx={{ width: 32, height: 32 }}>
                    {review.user.name[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">{review.user.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(review.createdAt)}
                    </Typography>
                  </Box>
                </Box>
                <PluginRating value={review.rating} readOnly size="small" />
              </Box>
              <Typography variant="body2">{review.comment}</Typography>
              {review.helpful > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {review.helpful} people found this helpful
                  </Typography>
                </Box>
              )}
            </Paper>
          ))}
        </Stack>

        {/* Pagination */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalReviewPages}
            page={reviewsPage}
            onChange={handleReviewPageChange}
          />
        </Box>
      </Box>
    )}

    {/* Versions Tab */}
    {activeTab === 'versions' && (
      <Box sx={{ py: 2 }}>
        <Timeline>
          {plugin.versions?.map((version, idx) => (
            <TimelineItem key={version.version}>
              <TimelineSeparator>
                <TimelineDot color={idx === 0 ? 'primary' : 'grey'} />
                {idx < plugin.versions.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1">
                      Version {version.version}
                      {idx === 0 && <Chip label="Latest" size="small" color="primary" sx={{ ml: 1 }} />}
                      {version.version === plugin.installedVersion && (
                        <Chip label="Installed" size="small" sx={{ ml: 1 }} />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Released {formatDate(version.releaseDate)}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined">
                    Download
                  </Button>
                </Box>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {version.releaseNotes}
                </Typography>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </Box>
    )}

    {/* Changelog Tab */}
    {activeTab === 'changelog' && (
      <Box sx={{ py: 2 }}>
        <Typography variant="body1" component="pre" sx={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '0.875rem'
        }}>
          {plugin.changelog}
        </Typography>
      </Box>
    )}
  </DialogContent>

  <DialogActions sx={{ p: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Version {plugin.version}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        {plugin.installedVersion ? (
          <>
            {plugin.hasUpdate && (
              <Button
                variant="contained"
                startIcon={<UpdateIcon />}
                disabled={installing}
                onClick={() => onUpdate(plugin.id)}
              >
                Update to {plugin.version}
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={installing}
              onClick={() => onUninstall(plugin.id)}
            >
              Uninstall
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            size="large"
            startIcon={installing ? <CircularProgress size={20} /> : <DownloadIcon />}
            disabled={installing}
            onClick={() => onInstall(plugin.id)}
          >
            Install Plugin
          </Button>
        )}
      </Box>
    </Box>
  </DialogActions>
</Dialog>
```

---

## 4. PluginReview.js - Review Submission Component

### Purpose
Form for submitting plugin reviews.

### Props
```javascript
{
  pluginId: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired, // (review) => Promise<void>
  onCancel: PropTypes.func.isRequired,
  initialReview: PropTypes.shape({
    rating: PropTypes.number,
    comment: PropTypes.string
  })
}
```

### State
```javascript
{
  rating: number,
  comment: string,
  submitting: boolean,
  errors: {
    rating: string,
    comment: string
  }
}
```

### Layout
```jsx
<Paper sx={{ p: 2, mb: 2 }}>
  <Typography variant="h6" gutterBottom>Write a Review</Typography>

  <Box sx={{ mb: 2 }}>
    <Typography variant="subtitle2" gutterBottom>Rating *</Typography>
    <PluginRating
      value={rating}
      onChange={(e, value) => setRating(value)}
      size="large"
    />
    {errors.rating && (
      <FormHelperText error>{errors.rating}</FormHelperText>
    )}
  </Box>

  <TextField
    fullWidth
    multiline
    rows={4}
    label="Your Review"
    placeholder="Share your experience with this plugin..."
    value={comment}
    onChange={(e) => setComment(e.target.value)}
    error={!!errors.comment}
    helperText={errors.comment || `${comment.length}/500 characters`}
    inputProps={{ maxLength: 500 }}
    sx={{ mb: 2 }}
  />

  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
    <Button onClick={onCancel} disabled={submitting}>
      Cancel
    </Button>
    <Button
      variant="contained"
      onClick={handleSubmit}
      disabled={submitting || !rating || !comment.trim()}
      startIcon={submitting && <CircularProgress size={16} />}
    >
      Submit Review
    </Button>
  </Box>
</Paper>
```

---

## 5. PluginRating.js - Star Rating Component

### Purpose
Display and input star ratings.

### Props
```javascript
{
  value: PropTypes.number,
  onChange: PropTypes.func,
  readOnly: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  precision: PropTypes.number, // Default 0.5
  showValue: PropTypes.bool // Show numeric value
}
```

### Layout
```jsx
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
  <Rating
    value={value}
    onChange={onChange}
    readOnly={readOnly}
    size={size}
    precision={precision}
    emptyIcon={<StarBorderIcon fontSize="inherit" />}
  />
  {showValue && value !== null && (
    <Typography variant="body2" color="text.secondary">
      {value.toFixed(1)}
    </Typography>
  )}
</Box>
```

---

## 6. PluginSearch.js - Search with Autocomplete

### Purpose
Search plugins with autocomplete suggestions.

### Props
```javascript
{
  onSearch: PropTypes.func.isRequired, // (query) => void
  suggestions: PropTypes.arrayOf(PropTypes.string),
  loading: PropTypes.bool
}
```

### State
```javascript
{
  query: string,
  open: boolean
}
```

### Layout
```jsx
<Autocomplete
  freeSolo
  open={open}
  onOpen={() => setOpen(true)}
  onClose={() => setOpen(false)}
  options={suggestions}
  loading={loading}
  inputValue={query}
  onInputChange={(e, value) => setQuery(value)}
  onChange={(e, value) => onSearch(value)}
  renderInput={(params) => (
    <TextField
      {...params}
      placeholder="Search plugins..."
      InputProps={{
        ...params.InputProps,
        startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
        endAdornment: (
          <>
            {loading && <CircularProgress size={20} />}
            {params.InputProps.endAdornment}
          </>
        )
      }}
      onKeyPress={(e) => {
        if (e.key === 'Enter') {
          onSearch(query);
        }
      }}
    />
  )}
  renderOption={(props, option) => (
    <li {...props}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SearchIcon fontSize="small" color="action" />
        <Typography>{option}</Typography>
      </Box>
    </li>
  )}
/>
```

---

## 7. PluginCategories.js - Category Browser

### Purpose
Display and filter by plugin categories.

### Props
```javascript
{
  categories: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    icon: PropTypes.node,
    count: PropTypes.number
  })),
  selected: PropTypes.string,
  onChange: PropTypes.func.isRequired // (categoryId) => void
}
```

### Default Categories
```javascript
const DEFAULT_CATEGORIES = [
  { id: 'all', name: 'All Plugins', icon: <AppsIcon />, count: 0 },
  { id: 'automation', name: 'Automation', icon: <AutoModeIcon />, count: 0 },
  { id: 'ui', name: 'UI Components', icon: <DashboardIcon />, count: 0 },
  { id: 'integration', name: 'Integrations', icon: <LinkIcon />, count: 0 },
  { id: 'ai', name: 'AI & ML', icon: <SmartToyIcon />, count: 0 },
  { id: 'data', name: 'Data & Analytics', icon: <AnalyticsIcon />, count: 0 },
  { id: 'dev-tools', name: 'Developer Tools', icon: <CodeIcon />, count: 0 },
  { id: 'security', name: 'Security', icon: <SecurityIcon />, count: 0 },
  { id: 'productivity', name: 'Productivity', icon: <WorkIcon />, count: 0 }
];
```

### Layout
```jsx
<List>
  {categories.map(category => (
    <ListItem
      key={category.id}
      button
      selected={selected === category.id}
      onClick={() => onChange(category.id)}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        '&.Mui-selected': {
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': {
            backgroundColor: 'primary.dark'
          }
        }
      }}
    >
      <ListItemIcon sx={{
        color: selected === category.id ? 'inherit' : 'action.active'
      }}>
        {category.icon}
      </ListItemIcon>
      <ListItemText
        primary={category.name}
        secondary={category.count > 0 ? `${category.count} plugins` : null}
        secondaryTypographyProps={{
          sx: { color: selected === category.id ? 'inherit' : 'text.secondary' }
        }}
      />
    </ListItem>
  ))}
</List>
```

---

## Theme Customization

### Material-UI Theme Extensions
```javascript
const theme = createTheme({
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          transition: 'box-shadow 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500
        }
      }
    }
  },
  palette: {
    primary: {
      main: '#1976d2'
    },
    success: {
      main: '#2e7d32'
    },
    warning: {
      main: '#ed6c02'
    }
  }
});
```

---

## Accessibility Features

1. **Keyboard Navigation**: All interactive elements accessible via keyboard
2. **ARIA Labels**: Proper labeling for screen readers
3. **Focus Management**: Clear focus indicators
4. **Semantic HTML**: Proper heading hierarchy
5. **Color Contrast**: WCAG AA compliant
6. **Alt Text**: All images have descriptive alt text

---

## Performance Optimizations

1. **Virtual Scrolling**: For large plugin lists (react-window)
2. **Lazy Loading**: Images and screenshots
3. **Memoization**: React.memo for PluginCard
4. **Debounced Search**: 300ms delay
5. **Pagination**: 24 plugins per page
6. **Code Splitting**: Dialog components lazy loaded

---

## Mobile Responsiveness

- **Breakpoints**: xs, sm, md, lg, xl
- **Drawer**: Temporary on mobile, permanent on desktop
- **Grid**: 1 column on xs, 2 on sm, 3 on md+
- **Touch Targets**: Minimum 48x48px
- **Swipe Gestures**: Screenshot navigation
