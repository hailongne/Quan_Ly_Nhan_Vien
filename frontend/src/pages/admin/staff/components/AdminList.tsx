// import type { ApiUser } from "../types";

// export default function AdminList({ admins, onChangePassword }: { admins: ApiUser[]; onChangePassword: (id:number)=>void }){
//   return (
//     <div>
//       <div style={{ fontWeight: 600, marginBottom: 8 }}>Admins</div>
//       <table style={{ width: '100%', borderCollapse: 'separate' }}>
//         <thead>
//           <tr style={{ textAlign: 'left', color: '#374151' }}>
//             <th style={{ padding: '8px' }}>Tên</th>
//             <th style={{ padding: '8px' }}>Tên đăng nhập</th>
//             <th style={{ padding: '8px' }}>Mật khẩu</th>
//           </tr>
//         </thead>
//         <tbody>
//           {admins.map((a, i)=> {
//             const idForAction = (a as any).id ?? (a as any).user_id ?? 0;
//             const key = `${idForAction}-${a.username ?? a.email ?? ''}-${i}`;
//             return (
//             <tr key={key} style={{ borderTop: '1px solid #eef2f7' }}>
//               <td style={{ padding: 12 }}>{a.name || a.username}</td>
//               <td style={{ padding: 12 }}>{a.username || a.email}</td>
//               <td style={{ padding: 12 }}>
//                 <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
//                   <span>••••••••</span>
//                   <button onClick={()=>onChangePassword(idForAction)} style={{ padding: '6px 8px', borderRadius: 8 }}>Đổi</button>
//                 </div>
//               </td>
//             </tr>
//             );
//           })}
//         </tbody>
//       </table>
//     </div>
//   );
// }
