const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, error: 'শুধুমাত্র অ্যাডমিন এই সুবিধা ব্যবহার করতে পারবেন!' });
  }
};

module.exports = { adminOnly };
