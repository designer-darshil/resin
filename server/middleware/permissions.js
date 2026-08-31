const requirePermission = (module, action = 'can_view') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin always has full access
    if (req.user.role_name === 'admin') {
      return next();
    }

    const perm = req.user.permissions[module];
    if (!perm || !perm[action]) {
      return res.status(403).json({
        error: 'Access denied',
        detail: `You do not have ${action} permission for ${module}`
      });
    }

    next();
  };
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role_name !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireFinancialAccess = (module) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role_name === 'admin') return next();

    const perm = req.user.permissions[module];
    if (!perm || !perm.has_financial_access) {
      return res.status(403).json({ error: 'Financial access required' });
    }
    next();
  };
};

module.exports = { requirePermission, requireAdmin, requireFinancialAccess };
