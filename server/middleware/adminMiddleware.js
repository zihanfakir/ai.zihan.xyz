const adminOnly = (req, res, next) => {
  const isVerifiedAdmin = (req.user && req.user.role === 'admin') || (req.user && req.user.email && req.user.email.toLowerCase().trim() === 'zihanfakir@gmail.com');
  if (isVerifiedAdmin) {
    next();
  } else {
    res.status(403).json({ success: false, error: 'শুধুমাত্র অ্যাডমিন এই সুবিধা ব্যবহার করতে পারবেন!' });
  }
};

module.exports = { adminOnly };
