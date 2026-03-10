import React, { useState } from 'react';
import { Box, Button, Input, VStack, Text } from '@chakra-ui/react';
import api from '../../api/axios';
import { notify } from '../../utils/notify';

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return notify.error('Thiếu thông tin', 'Nhập email hoặc tên đăng nhập');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { identifier: identifier.trim() });
      notify.success('Đã gửi yêu cầu', 'Nếu tài khoản tồn tại, hãy kiểm tra email để đặt lại mật khẩu.');
      setIdentifier('');
    } catch (err: any) {
      notify.success('Đã gửi yêu cầu', 'Nếu tài khoản tồn tại, hãy kiểm tra email để đặt lại mật khẩu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" p={6}>
      <Box w={{ base: 'full', md: '480px' }} bg="white" p={6} borderRadius="12px" boxShadow="sm">
        <Text fontSize="2xl" fontWeight={700} mb={4}>Quên mật khẩu</Text>
        <Text fontSize="sm" mb={6} color="gray.600">Nhập email hoặc tên đăng nhập. Nếu tài khoản tồn tại, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.</Text>
        <form onSubmit={handleSubmit}>
          <VStack spacing={4} align="stretch">
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email hoặc tên đăng nhập" />
            <Button type="submit" isLoading={loading} colorScheme="blue" isDisabled={loading || !identifier.trim()}>Gửi yêu cầu</Button>
          </VStack>
        </form>
      </Box>
    </Box>
  );
}
