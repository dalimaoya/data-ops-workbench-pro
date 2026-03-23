import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Dropdown, Button, Space, Tag, Modal, Form, Input, message, Badge, List, Typography, Popover, Empty } from 'antd';
const { Text: TypoText } = Typography;
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
  AuditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  CheckOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { changeMyPassword, updateMyProfile } from '../api/users';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications';
import type { NotificationItem } from '../api/notifications';
import { useTranslation } from 'react-i18next';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 72;

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  labelKey: string;
  roles?: string[];
}

const allMenuItems: MenuItem[] = [
  { key: '/', icon: <HomeOutlined />, labelKey: 'menu.dashboard' },
  { key: '/datasource', icon: <DatabaseOutlined />, labelKey: 'menu.datasource', roles: ['admin'] },
  { key: '/table-config', icon: <TableOutlined />, labelKey: 'menu.tableConfig' },
  { key: '/data-maintenance', icon: <ToolOutlined />, labelKey: 'menu.dataMaintenance' },
  { key: '/log-center', icon: <FileTextOutlined />, labelKey: 'menu.logCenter' },
  { key: '/approval-center', icon: <AuditOutlined />, labelKey: 'menu.approvalCenter', roles: ['admin'] },
  { key: '/version-rollback', icon: <HistoryOutlined />, labelKey: 'menu.versionRollback', roles: ['admin'] },
  { key: '/user-management', icon: <TeamOutlined />, labelKey: 'menu.userManagement', roles: ['admin'] },
  { key: '/about', icon: <InfoCircleOutlined />, labelKey: 'menu.about' },
];

export default function MainLayout() {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [collapseHover, setCollapseHover] = useState(false);
  const [collapseActive, setCollapseActive] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, login, token } = useAuth();

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [pwdLoading, setPwdLoading] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm] = Form.useForm();
  const [profileLoading, setProfileLoading] = useState(false);

  // v2.3: Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await listNotifications({ page_size: 10 });
      setNotifications(res.data.items);
      setUnreadCount(res.data.unread_count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      fetchNotifications();
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      fetchNotifications();
    } catch { /* ignore */ }
  };

  const handleNotifClick = (item: NotificationItem) => {
    if (item.is_read === 0) {
      handleMarkRead(item.id);
    }
    if (item.related_url) {
      navigate(item.related_url);
      setNotifOpen(false);
    }
  };

  const userRole = user?.role || '';
  const siderWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  const menuItems = allMenuItems
    .filter(item => !item.roles || item.roles.includes(userRole))
    .map(({ key, icon, labelKey }) => ({ key, icon, label: t(labelKey) }));

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
      message.success(t('password.changeSuccess'));
      setPwdOpen(false);
      pwdForm.resetFields();
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
      message.success(t('profile.changeSuccess'));
      setProfileOpen(false);
      profileForm.resetFields();
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

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const languageMenuItems = [
    {
      key: 'zh',
      label: t('common.langZh'),
      onClick: () => handleLanguageChange('zh'),
    },
    {
      key: 'en',
      label: 'English',
      onClick: () => handleLanguageChange('en'),
    },
  ];

  const userMenuItems = [
    {
      key: 'info',
      label: (
        <Space>
          <UserOutlined />
          {user?.display_name || user?.username}
          <Tag>{t(`role.${user?.role || ''}`) || user?.role}</Tag>
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
          {t('header.changePassword')}
        </Space>
      ),
      onClick: () => setPwdOpen(true),
    },
    {
      key: 'change-name',
      label: (
        <Space>
          <EditOutlined />
          {t('header.changeName')}
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
          {t('header.logout')}
        </Space>
      ),
      onClick: handleLogout,
    },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Fixed Sidebar */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: siderWidth,
          zIndex: 100,
          background: 'linear-gradient(180deg, #0B1530 0%, #0E1B3D 55%, #0A234A 100%)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.2, 0, 0, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Brand Area */}
        <div style={{ padding: '20px 16px 0 16px', flexShrink: 0 }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(126,167,255,0.15)',
              borderRadius: 12,
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: collapsed ? '0 8px' : '0 12px',
              overflow: 'hidden',
              transition: 'padding 0.25s',
            }}
          >
            <img
              src="/logo.png"
              alt="DataOps Workbench"
              style={{
                width: collapsed ? 40 : '100%',
                height: collapsed ? 40 : 'auto',
                maxHeight: 60,
                objectFit: collapsed ? 'cover' : 'contain',
                objectPosition: 'left',
                transition: 'all 0.25s',
              }}
            />
          </div>
        </div>

        {/* Menu Items */}
        <div style={{ padding: '16px 12px 8px 12px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {menuItems.map(item => {
            const isSelected = item.key === selectedKey;
            const isHovered = hoveredKey === item.key;

            let bg = 'transparent';
            let border = '1px solid transparent';
            let borderLeft = '3px solid transparent';
            let textColor = '#B8C4DA';
            let iconColor = '#AAB6CC';

            if (isSelected) {
              bg = 'linear-gradient(90deg, rgba(88,141,255,0.22) 0%, rgba(48,212,191,0.14) 100%)';
              border = '1px solid rgba(122,180,255,0.18)';
              borderLeft = '3px solid #35D6C1';
              textColor = '#FFFFFF';
              iconColor = '#FFFFFF';
            } else if (isHovered) {
              bg = 'rgba(255,255,255,0.05)';
              iconColor = '#DDE8FF';
            }

            return (
              <div
                key={item.key}
                onClick={() => navigate(item.key)}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  height: 48,
                  padding: collapsed ? '0' : '0 16px',
                  marginBottom: 8,
                  borderRadius: 12,
                  cursor: 'pointer',
                  color: textColor,
                  background: bg,
                  border: border,
                  borderLeft: borderLeft,
                  transition: 'all 0.2s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: '24px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    color: iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    width: 20,
                    height: 20,
                    transition: 'color 0.2s',
                  }}
                >
                  {item.icon}
                </span>
                {!collapsed && (
                  <span style={{ transition: 'opacity 0.2s', opacity: 1 }}>
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Collapse Button */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 12,
            paddingBottom: 16,
            paddingLeft: 12,
            paddingRight: 12,
          }}
        >
          <div
            onClick={() => setCollapsed(!collapsed)}
            onMouseEnter={() => setCollapseHover(true)}
            onMouseLeave={() => { setCollapseHover(false); setCollapseActive(false); }}
            onMouseDown={() => setCollapseActive(true)}
            onMouseUp={() => setCollapseActive(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10,
              height: 42,
              padding: collapsed ? '0' : '0 16px',
              borderRadius: 10,
              cursor: 'pointer',
              color: '#7F8CA8',
              background: collapseActive
                ? 'rgba(88,141,255,0.16)'
                : collapseHover
                  ? 'rgba(255,255,255,0.06)'
                  : 'transparent',
              transition: 'all 0.2s ease',
            }}
          >
            {collapsed
              ? <MenuUnfoldOutlined style={{ fontSize: 19 }} />
              : <MenuFoldOutlined style={{ fontSize: 19 }} />
            }
            {!collapsed && (
              <span style={{ fontSize: 14, fontWeight: 400 }}>{t('menu.collapse')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          marginLeft: siderWidth,
          transition: 'margin-left 0.25s cubic-bezier(0.2, 0, 0, 1)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 56,
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
          }}
        >
          <Space size={8}>
            {/* Language Switcher */}
            <Dropdown menu={{ items: languageMenuItems, selectedKeys: [i18n.language] }} placement="bottomRight">
              <Button type="text" icon={<GlobalOutlined />}>
                {i18n.language === 'zh' ? t('common.langZh') : t('common.langEn')}
              </Button>
            </Dropdown>

            <Popover
              open={notifOpen}
              onOpenChange={setNotifOpen}
              trigger="click"
              placement="bottomRight"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('header.notifications')}</span>
                  {unreadCount > 0 && (
                    <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
                      {t('header.markAllRead')}
                    </Button>
                  )}
                </div>
              }
              content={
                <div style={{ width: 340, maxHeight: 400, overflow: 'auto' }}>
                  {notifications.length === 0 ? (
                    <Empty description={t('header.noNotifications')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <List
                      size="small"
                      dataSource={notifications}
                      renderItem={(item) => (
                        <List.Item
                          style={{
                            cursor: item.related_url ? 'pointer' : 'default',
                            background: item.is_read === 0 ? '#f6ffed' : 'transparent',
                            padding: '8px 4px',
                          }}
                          onClick={() => handleNotifClick(item)}
                        >
                          <List.Item.Meta
                            title={
                              <Space>
                                {item.is_read === 0 && <Badge status="processing" />}
                                <TypoText strong={item.is_read === 0} style={{ fontSize: 13 }}>
                                  {item.title}
                                </TypoText>
                              </Space>
                            }
                            description={
                              <div>
                                <div style={{ fontSize: 12, color: '#666' }}>{item.message}</div>
                                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                                  {item.created_at ? new Date(item.created_at).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US') : ''}
                                </div>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              }
            >
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
              </Badge>
            </Popover>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" icon={<UserOutlined />}>
                {user?.display_name || user?.username}
              </Button>
            </Dropdown>
          </Space>
        </div>

        {/* Content */}
        <div style={{ margin: 16, flex: 1 }}>
          <Outlet />
        </div>
      </div>

      {/* Password Modal */}
      <Modal
        title={t('password.title')}
        open={pwdOpen}
        onOk={handleChangePassword}
        onCancel={() => { setPwdOpen(false); pwdForm.resetFields(); }}
        confirmLoading={pwdLoading}
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="old_password" label={t('password.oldPassword')} rules={[{ required: true, message: t('password.oldPasswordRequired') }]}>
            <Input.Password placeholder={t('password.oldPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item name="new_password" label={t('password.newPassword')} rules={[{ required: true, message: t('password.newPasswordRequired') }, { min: 4, message: t('password.passwordMinLength') }]}>
            <Input.Password placeholder={t('password.newPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label={t('password.confirmPassword')}
            dependencies={['new_password']}
            rules={[
              { required: true, message: t('password.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('password.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password placeholder={t('password.confirmPasswordPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Profile Modal */}
      <Modal
        title={t('profile.title')}
        open={profileOpen}
        onOk={handleUpdateProfile}
        onCancel={() => { setProfileOpen(false); profileForm.resetFields(); }}
        confirmLoading={profileLoading}
        destroyOnClose
      >
        <Form form={profileForm} layout="vertical">
          <Form.Item name="display_name" label={t('profile.displayName')} rules={[{ required: true, message: t('profile.displayNameRequired') }]}>
            <Input placeholder={t('profile.displayNamePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
