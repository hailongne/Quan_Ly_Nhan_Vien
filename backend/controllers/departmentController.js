const { Op } = require('sequelize');
const { Department, User } = require('../models');

const sanitizeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeName = (value) => {
  const trimmed = sanitizeString(value);
  return trimmed.length ? trimmed : null;
};

const shapeDepartment = (instance) => {
  if (!instance) return null;
  const plain = instance.get ? instance.get({ plain: true }) : instance;
  const manager = plain.manager ? {
    user_id: plain.manager.user_id,
    name: plain.manager.name,
    email: plain.manager.email,
    department_position: plain.manager.department_position
  } : null;
  return {
    department_id: plain.department_id,
    name: plain.name,
    description: plain.description ?? null,
    manager_user_id: plain.manager_user_id ?? null,
    manager,
    created_at: plain.created_at,
    updated_at: plain.updated_at
  };
};

exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      order: [['name', 'ASC']],
      include: [{ model: User, as: 'manager', attributes: ['user_id', 'name', 'email', 'department_position'] }]
    });
    const shaped = departments.map(shapeDepartment);
    res.json(shaped);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const name = normalizeName(req.body?.name);
    const description = sanitizeString(req.body?.description ?? '');
    const normalizedDescription = description.length ? description : null;
    const managerUserId = req.body?.manager_user_id ? Number(req.body.manager_user_id) : null;

    if (!name) {
      return res.status(400).json({ message: 'Tên phòng ban là bắt buộc' });
    }

    const duplicate = await Department.findOne({ where: { name } });
    if (duplicate) {
      return res.status(400).json({ message: 'Phòng ban đã tồn tại' });
    }

    const payload = { name, description: normalizedDescription };

    if (managerUserId) {
      const manager = await User.findByPk(managerUserId);
      if (!manager) {
        return res.status(400).json({ message: 'Trưởng phòng không tồn tại' });
      }
      payload.manager_user_id = manager.user_id;
    }

    const department = await Department.create(payload, { include: [{ model: User, as: 'manager' }] });
    const withManager = await Department.findByPk(department.department_id, {
      include: [{ model: User, as: 'manager', attributes: ['user_id', 'name', 'email', 'department_position'] }]
    });

    res.status(201).json({ message: 'Đã tạo phòng ban', department: shapeDepartment(withManager) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const id = Number(req.params?.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const department = await Department.findByPk(id);
    if (!department) {
      return res.status(404).json({ message: 'Phòng ban không tồn tại' });
    }

    const nextName = normalizeName(req.body?.name);
    const nextDescription = sanitizeString(req.body?.description ?? '');
    const descriptionValue = nextDescription.length ? nextDescription : null;
    const managerUserIdRaw = typeof req.body?.manager_user_id !== 'undefined' ? req.body.manager_user_id : undefined;

    const updates = {};

    if (nextName) {
      const duplicate = await Department.findOne({
        where: {
          name: nextName,
          department_id: { [Op.ne]: department.department_id }
        }
      });
      if (duplicate) {
        return res.status(400).json({ message: 'Tên phòng ban đã tồn tại' });
      }
      updates.name = nextName;
    }

    updates.description = descriptionValue;

    if (managerUserIdRaw !== undefined) {
      if (managerUserIdRaw === null || managerUserIdRaw === '') {
        updates.manager_user_id = null;
      } else {
        const managerId = Number(managerUserIdRaw);
        if (!Number.isFinite(managerId)) {
          return res.status(400).json({ message: 'Trưởng phòng không hợp lệ' });
        }

        const manager = await User.findByPk(managerId);
        if (!manager) {
          return res.status(400).json({ message: 'Trưởng phòng không tồn tại' });
        }

        if (manager.department_id && manager.department_id !== department.department_id) {
          return res.status(400).json({ message: 'Nhân sự được chọn không thuộc phòng ban này' });
        }

        updates.manager_user_id = manager.user_id;
      }
    }

    await department.update(updates);
    const refreshed = await Department.findByPk(department.department_id, {
      include: [{ model: User, as: 'manager', attributes: ['user_id', 'name', 'email', 'department_position'] }]
    });
    res.json({ message: 'Đã cập nhật phòng ban', department: shapeDepartment(refreshed) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const id = Number(req.params?.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const department = await Department.findByPk(id);
    if (!department) {
      return res.status(404).json({ message: 'Phòng ban không tồn tại' });
    }

    const inUse = await User.findOne({ where: { department_id: id } })
      || await User.findOne({ where: { department: department.name } });

    if (inUse) {
      return res.status(400).json({ message: 'Không thể xóa phòng ban đang được sử dụng' });
    }

    await department.destroy();
    res.json({ message: 'Đã xóa phòng ban' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
