const adminOnly = (req, res, next) => {
  const adminEmails = ['zihanfakir@gmail.com', 'x@zihan.uk'];
  const isVerifiedAdmin = (req.user && req.user.role === 'admin') || (req.user && req.user.email && adminEmails.includes(req.user.email.toLowerCase().trim()));
  if (isVerifiedAdmin) {
    next();
  } else {
    res.status(403).json({ success: false, error: 'শুধুমাত্র অ্যাডমিন এই সুবিধা ব্যবহার করতে পারবেন!' });
  }
};

module.exports = { adminOnly };
