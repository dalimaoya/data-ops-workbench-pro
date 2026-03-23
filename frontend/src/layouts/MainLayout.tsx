import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Button, Space, Tag, Modal, Form, Input, message, ConfigProvider } from 'antd';
import {
  DatabaseOutlined,
  TableOutlined,
  ToolOutlined,
  FileTextOutlined,
  HistoryOutlined,
  HomeOutlined,
  UserOutlined,
  LogoutOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  KeyOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { changeMyPassword, updateMyProfile } from '../api/users';

const { Sider, Content, Header } = Layout;

// 侧边栏使用渐变背景，Menu 透明叠加

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[]; // undefined = all roles
}

const allMenuItems: MenuItem[] = [
  { key: '/', icon: <HomeOutlined />, label: '工作台总览' },
  { key: '/datasource', icon: <DatabaseOutlined />, label: '数据源管理', roles: ['admin'] },
  { key: '/table-config', icon: <TableOutlined />, label: '表配置管理' },
  { key: '/data-maintenance', icon: <ToolOutlined />, label: '数据维护' },
  { key: '/log-center', icon: <FileTextOutlined />, label: '日志中心' },
  { key: '/version-rollback', icon: <HistoryOutlined />, label: '版本回退', roles: ['admin'] },
  { key: '/user-management', icon: <TeamOutlined />, label: '用户管理', roles: ['admin'] },
  { key: '/about', icon: <InfoCircleOutlined />, label: '关于系统' },
];

const roleLabels: Record<string, string> = {
  admin: '管理员',
  operator: '操作员',
  readonly: '只读用户',
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, login, token } = useAuth();

  // Password modal
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [pwdLoading, setPwdLoading] = useState(false);

  // Profile modal
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm] = Form.useForm();
  const [profileLoading, setProfileLoading] = useState(false);

  const userRole = user?.role || '';

  // Filter menu items by role
  const menuItems = allMenuItems
    .filter(item => !item.roles || item.roles.includes(userRole))
    .map(({ key, icon, label }) => ({ key, icon, label }));

  const selectedKey = menuItems
    .filter(i => location.pathname.startsWith(i.key) && i.key !== '/')
    .sort((a, b) => b.key.length - a.key.length)[0]?.key
    || (location.pathname === '/' ? '/' : '/');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleChangePassword = async () => {
    try {
      const values = await pwdForm.validateFields();
      setPwdLoading(true);
      await changeMyPassword(values.old_password, values.new_password);
      message.success('密码修改成功，请重新登录');
      setPwdOpen(false);
      pwdForm.resetFields();
      // Force re-login
      setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 1000);
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const values = await profileForm.validateFields();
      setProfileLoading(true);
      await updateMyProfile(values.display_name);
      message.success('显示名修改成功');
      setProfileOpen(false);
      profileForm.resetFields();
      // Update local user info
      if (user && token) {
        login(token, { ...user, display_name: values.display_name });
      }
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const userMenuItems = [
    {
      key: 'info',
      label: (
        <Space>
          <UserOutlined />
          {user?.display_name || user?.username}
          <Tag>{roleLabels[user?.role || ''] || user?.role}</Tag>
        </Space>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'change-password',
      label: (
        <Space>
          <KeyOutlined />
          修改密码
        </Space>
      ),
      onClick: () => setPwdOpen(true),
    },
    {
      key: 'change-name',
      label: (
        <Space>
          <EditOutlined />
          修改显示名
        </Space>
      ),
      onClick: () => {
        profileForm.setFieldsValue({ display_name: user?.display_name || '' });
        setProfileOpen(true);
      },
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      label: (
        <Space>
          <LogoutOutlined />
          退出登录
        </Space>
      ),
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <ConfigProvider theme={{
        components: {
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(255,255,255,0.1)',
            darkItemHoverBg: 'rgba(255,255,255,0.06)',
            darkItemColor: 'rgba(255,255,255,0.65)',
            darkItemSelectedColor: '#fff',
            itemHeight: 48,
            iconSize: 18,
            fontSize: 15,
          },
        },
      }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="dark"
          style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' }}
        >
          <div style={{
            padding: collapsed ? '16px 8px 8px' : '16px 8px 8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <img src="/logo.png" alt="logo" style={{ width: collapsed ? 48 : '85%', objectFit: 'contain' }} />
            {!collapsed && (
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 22, textAlign: 'center', letterSpacing: 4, whiteSpace: 'nowrap' }}>
                数据运维工作台
              </span>
            )}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent' }}
          />
        </Sider>
      </ConfigProvider>
      <Layout>
        <Header style={{
          background: '#fff', padding: '0 24px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {user?.display_name || user?.username}
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={pwdOpen}
        onOk={handleChangePassword}
        onCancel={() => { setPwdOpen(false); pwdForm.resetFields(); }}
        confirmLoading={pwdLoading}
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="old_password" label="旧密码" rules={[{ required: true, message: '请输入旧密码' }]}>
            <Input.Password placeholder="请输入旧密码" />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 4, message: '密码至少4位' }]}>
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改显示名弹窗 */}
      <Modal
        title="修改显示名"
        open={profileOpen}
        onOk={handleUpdateProfile}
        onCancel={() => { setProfileOpen(false); profileForm.resetFields(); }}
        confirmLoading={profileLoading}
        destroyOnClose
      >
        <Form form={profileForm} layout="vertical">
          <Form.Item name="display_name" label="显示名" rules={[{ required: true, message: '请输入显示名' }]}>
            <Input placeholder="请输入新的显示名" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
