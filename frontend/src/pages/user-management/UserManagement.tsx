import { useState, useEffect } from 'react';
import {
  Table, Card, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, LockOutlined, StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import {
  listUsers, createUser, updateUser, updateUserStatus, resetUserPassword,
} from '../../api/users';
import type { UserItem } from '../../api/users';
import { formatBeijingTime } from '../../utils/formatTime';

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '操作员', value: 'operator' },
  { label: '只读用户', value: 'readonly' },
];

const roleLabels: Record<string, string> = {
  admin: '管理员',
  operator: '操作员',
  readonly: '只读用户',
};

const roleColors: Record<string, string> = {
  admin: 'red',
  operator: 'blue',
  readonly: 'default',
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Reset password modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetForm] = Form.useForm();
  const [resetLoading, setResetLoading] = useState(false);
  const [resetUser, setResetUser] = useState<UserItem | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await listUsers();
      setUsers(res.data);
    } catch {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      await createUser(values);
      message.success('用户创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      fetchUsers();
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      await updateUser(editingUser.id, values);
      message.success('用户信息已更新');
      setEditOpen(false);
      editForm.resetFields();
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (record: UserItem) => {
    const newStatus = record.status === 'enabled' ? 'disabled' : 'enabled';
    try {
      await updateUserStatus(record.id, newStatus);
      message.success(newStatus === 'enabled' ? '用户已启用' : '用户已禁用');
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败');
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    try {
      const values = await resetForm.validateFields();
      setResetLoading(true);
      await resetUserPassword(resetUser.id, values.new_password);
      message.success('密码已重置');
      setResetOpen(false);
      resetForm.resetFields();
      setResetUser(null);
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setResetLoading(false);
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    { title: '显示名', dataIndex: 'display_name', key: 'display_name', width: 120 },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 100,
      render: (role: string) => (
        <Tag color={roleColors[role] || 'default'}>{roleLabels[role] || role}</Tag>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (status: string) => (
        <Tag color={status === 'enabled' ? 'green' : 'red'}>
          {status === 'enabled' ? '正常' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: (val: string) => formatBeijingTime(val),
    },
    {
      title: '操作', key: 'action', width: 240,
      render: (_: unknown, record: UserItem) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingUser(record);
              editForm.setFieldsValue({
                display_name: record.display_name,
                role: record.role,
              });
              setEditOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<LockOutlined />}
            onClick={() => {
              setResetUser(record);
              setResetOpen(true);
            }}
          >
            重置密码
          </Button>
          {record.username !== 'admin' && (
            <Popconfirm
              title={record.status === 'enabled' ? '确认禁用该用户？' : '确认启用该用户？'}
              onConfirm={() => handleToggleStatus(record)}
            >
              <Button
                size="small"
                danger={record.status === 'enabled'}
                icon={record.status === 'enabled' ? <StopOutlined /> : <CheckCircleOutlined />}
              >
                {record.status === 'enabled' ? '禁用' : '启用'}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="用户管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新增用户
          </Button>
        }
      >
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 新增用户弹窗 */}
      <Modal
        title="新增用户"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        confirmLoading={createLoading}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名">
            <Input placeholder="请输入显示名（可选）" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 4, message: '密码至少4位' }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleOptions} placeholder="请选择角色" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户弹窗 */}
      <Modal
        title={`编辑用户 - ${editingUser?.username || ''}`}
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); setEditingUser(null); }}
        confirmLoading={editLoading}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="display_name" label="显示名">
            <Input placeholder="请输入显示名" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleOptions} placeholder="请选择角色" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title={`重置密码 - ${resetUser?.username || ''}`}
        open={resetOpen}
        onOk={handleResetPassword}
        onCancel={() => { setResetOpen(false); resetForm.resetFields(); setResetUser(null); }}
        confirmLoading={resetLoading}
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 4, message: '密码至少4位' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
