// import React, { useState, useEffect } from 'react'
// import {
//   Form,
//   Button,
//   Switch,
//   Card,
//   Input,
//   message,
//   Alert,
//   Popconfirm,
//   Typography,
//   Modal,
//   List,
//   Avatar,
//   Tag,
//   Space,
//   Tooltip,
// } from 'antd'
// import { EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, StarOutlined, StarFilled } from '@ant-design/icons'
// import { AppSettings } from '../../types/settings'
// import { ThumbnailLayout } from '../../types/thumbnail'
// import { updateSettings, thumbnailApi, ThumbnailLayout as ApiThumbnailLayout } from '../../api'
// import ThumbnailEditor from '../../components/ThumbnailEditor/ThumbnailEditor'
//
// const { Text, Title } = Typography
// const { TextArea } = Input
//
// interface ThumbnailSettingsFormProps {
//   initialSettings?: AppSettings
// }
//
// export const ThumbnailSettingsForm: React.FC<ThumbnailSettingsFormProps> = ({ initialSettings = {} }) => {
//   const [form] = Form.useForm()
//   const [loading, setLoading] = useState(false)
//   const [layouts, setLayouts] = useState<ApiThumbnailLayout[]>([])
//   const [selectedLayoutId, setSelectedLayoutId] = useState<string>('')
//
//   // 에디터 다이얼로그 상태
//   const [editorVisible, setEditorVisible] = useState<boolean>(false)
//   const [editingLayout, setEditingLayout] = useState<ApiThumbnailLayout | null>(null)
//   const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false)
//   const [previewVisible, setPreviewVisible] = useState<boolean>(false)
//   const [previewImage, setPreviewImage] = useState<string>('')
//   const [generatingPreview, setGeneratingPreview] = useState<boolean>(false)
//
//   // 폼 초기값 설정
//   useEffect(() => {
//     form.setFieldsValue({
//       thumbnailEnabled: initialSettings.thumbnailEnabled || false,
//       thumbnailDefaultLayoutId: initialSettings.thumbnailDefaultLayoutId || '',
//     })
//
//     setSelectedLayoutId(initialSettings.thumbnailDefaultLayoutId || '')
//   }, [initialSettings, form])
//
//   // 레이아웃 목록 로드
//   useEffect(() => {
//     loadLayouts()
//   }, [])
//
//   const loadLayouts = async () => {
//     try {
//       const result = await thumbnailApi.getThumbnailLayouts()
//       if (result.success && result.layouts) {
//         setLayouts(result.layouts)
//
//         // 기본 레이아웃이 있으면 선택
//         const defaultLayout = result.layouts.find(layout => layout.isDefault)
//         if (defaultLayout && !selectedLayoutId) {
//           setSelectedLayoutId(defaultLayout.id)
//           form.setFieldValue('thumbnailDefaultLayoutId', defaultLayout.id)
//         }
//       } else {
//         message.error(result.error || '레이아웃 목록을 불러올 수 없습니다.')
//       }
//     } catch (error) {
//       console.error('레이아웃 목록 로드 실패:', error)
//       message.error('레이아웃 목록 로드 중 오류가 발생했습니다.')
//     }
//   }
//
//   const handleSave = async () => {
//     try {
//       setLoading(true)
//       const values = await form.validateFields()
//       alert(values)
//
//       const settings: Partial<AppSettings> = {
//         ...values,
//         thumbnailDefaultLayoutId: selectedLayoutId,
//       }
//
//       const updatedSettings = { ...settings }
//       await updateSettings(updatedSettings)
//       message.success('썸네일 설정이 저장되었습니다.')
//     } catch (error) {
//       console.error('설정 저장 실패:', error)
//       message.error('설정 저장에 실패했습니다.')
//     } finally {
//       setLoading(false)
//     }
//   }
//
//   const handleCreateNew = () => {
//     setEditingLayout(null)
//     setIsCreatingNew(true)
//     setEditorVisible(true)
//   }
//
//   const handleEditLayout = (layout: ApiThumbnailLayout) => {
//     setEditingLayout(layout)
//     setIsCreatingNew(false)
//     setEditorVisible(true)
//   }
//
//   const handleDeleteLayout = async (layoutId: string) => {
//     try {
//       const result = await thumbnailApi.deleteThumbnailLayout(layoutId)
//       if (result.success) {
//         message.success('레이아웃이 삭제되었습니다.')
//         await loadLayouts()
//
//         // 선택된 레이아웃이 삭제된 경우 선택 해제
//         if (selectedLayoutId === layoutId) {
//           setSelectedLayoutId('')
//           form.setFieldValue('thumbnailDefaultLayoutId', '')
//         }
//       } else {
//         message.error(result.error || '레이아웃 삭제에 실패했습니다.')
//       }
//     } catch (error) {
//       console.error('레이아웃 삭제 실패:', error)
//       message.error('레이아웃 삭제 중 오류가 발생했습니다.')
//     }
//   }
//
//   const handleSetDefault = async (layoutId: string) => {
//     try {
//       const result = await thumbnailApi.updateThumbnailLayout(layoutId, {
//         isDefault: true,
//       })
//       if (result.success) {
//         message.success('기본 레이아웃으로 설정되었습니다.')
//         await loadLayouts()
//         setSelectedLayoutId(layoutId)
//         form.setFieldValue('thumbnailDefaultLayoutId', layoutId)
//       } else {
//         message.error(result.error || '기본 레이아웃 설정에 실패했습니다.')
//       }
//     } catch (error) {
//       console.error('기본 레이아웃 설정 실패:', error)
//       message.error('기본 레이아웃 설정 중 오류가 발생했습니다.')
//     }
//   }
//
//   const handleEditorSave = async (layout: ThumbnailLayout, name: string, description?: string) => {
//     try {
//       if (isCreatingNew) {
//         // 새 레이아웃 생성
//         const result = await thumbnailApi.createThumbnailLayout({
//           name,
//           description,
//           data: layout,
//           isDefault: layouts.length === 0, // 첫 번째 레이아웃이면 기본으로 설정
//         })
//
//         if (result.success) {
//           message.success('레이아웃이 생성되었습니다.')
//           await loadLayouts()
//           setEditorVisible(false)
//         } else {
//           message.error(result.error || '레이아웃 생성에 실패했습니다.')
//         }
//       } else if (editingLayout) {
//         // 기존 레이아웃 수정
//         const result = await thumbnailApi.updateThumbnailLayout(editingLayout.id, {
//           name,
//           description,
//           data: layout,
//         })
//
//         if (result.success) {
//           message.success('레이아웃이 수정되었습니다.')
//           await loadLayouts()
//           setEditorVisible(false)
//         } else {
//           message.error(result.error || '레이아웃 수정에 실패했습니다.')
//         }
//       }
//     } catch (error) {
//       console.error('레이아웃 저장 실패:', error)
//       message.error('레이아웃 저장 중 오류가 발생했습니다.')
//     }
//   }
//
//   const handleEditorClose = () => {
//     setEditorVisible(false)
//     setEditingLayout(null)
//     setIsCreatingNew(false)
//   }
//
//   const handleLayoutSelect = (layoutId: string) => {
//     setSelectedLayoutId(layoutId)
//     form.setFieldValue('thumbnailDefaultLayoutId', layoutId)
//   }
//
//   const handlePreviewLayout = async (layout: ApiThumbnailLayout) => {
//     try {
//       // setGeneratingPreview(true)
//       //
//       // // 레이아웃의 첫 번째 텍스트 요소에서 제목 추출
//       // const titleElement = layout.data.elements.find(el => el.type === 'title')
//       // const subtitleElement = layout.data.elements.find(el => el.type === 'subtitle')
//       //
//       // const request = {
//       //   backgroundImageFileName: layout.data.backgroundImage,
//       //   layout: {
//       //     id: layout.data.id,
//       //     backgroundImage: layout.data.backgroundImage,
//       //     elements: layout.data.elements.map(el => ({
//       //       ...el,
//       //       text:
//       //         el.type === 'title'
//       //           ? titleElement?.text || '샘플 제목'
//       //           : el.type === 'subtitle'
//       //             ? subtitleElement?.text || '샘플 부제목'
//       //             : el.text,
//       //     })),
//       //     createdAt: layout.data.createdAt,
//       //     updatedAt: layout.data.updatedAt,
//       //   },
//       //   uploadToGCS: false,
//       // }
//       //
//       // const result = await thumbnailApi.previewThumbnailWithLayout(request)
//       //
//       // if (result.success && result.base64) {
//       //   setPreviewImage(result.base64)
//       //   setPreviewVisible(true)
//       //   message.success('미리보기가 생성되었습니다.')
//       // } else {
//       //   message.error(result.error || '미리보기 생성에 실패했습니다.')
//       // }
//     } catch (error) {
//       console.error('미리보기 생성 실패:', error)
//       message.error('미리보기 생성 중 오류가 발생했습니다.')
//     } finally {
//       setGeneratingPreview(false)
//     }
//   }
//
//   return (
//     <div>
//       <Form form={form} layout="vertical" onFinish={handleSave}>
//         <Card title="썸네일 기본 설정" className="mb-4">
//           <Form.Item
//             name="thumbnailEnabled"
//             label="썸네일 생성"
//             tooltip="게시물 작성 시 자동으로 썸네일을 생성합니다"
//             valuePropName="checked"
//           >
//             <Switch />
//           </Form.Item>
//
//           <Alert
//             message="썸네일 레이아웃 관리"
//             description="썸네일 레이아웃을 생성하고 관리할 수 있습니다. 각 레이아웃은 텍스트 요소의 위치, 폰트, 색상 등의 설정을 포함합니다."
//             type="info"
//             showIcon
//             className="mb-4"
//           />
//         </Card>
//
//         <Card
//           title="썸네일 레이아웃 관리"
//           extra={
//             <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
//               새 레이아웃 만들기
//             </Button>
//           }
//         >
//           {layouts.length === 0 ? (
//             <Alert
//               message="레이아웃이 없습니다"
//               description="새 레이아웃을 만들어 썸네일 디자인을 시작하세요."
//               type="warning"
//               showIcon
//             />
//           ) : (
//             <List
//               grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
//               dataSource={layouts}
//               renderItem={layout => (
//                 <List.Item>
//                   <Card
//                     size="small"
//                     hoverable
//                     className={`layout-card ${selectedLayoutId === layout.id ? 'selected' : ''}`}
//                     onClick={() => handleLayoutSelect(layout.id)}
//                     actions={[
//                       <Tooltip title="미리보기">
//                         <Button
//                           key="preview"
//                           type="text"
//                           icon={<EyeOutlined />}
//                           loading={generatingPreview}
//                           onClick={e => {
//                             e.stopPropagation()
//                             handlePreviewLayout(layout)
//                           }}
//                         />
//                       </Tooltip>,
//                       <Tooltip title="편집">
//                         <Button
//                           key="edit"
//                           type="text"
//                           icon={<EditOutlined />}
//                           onClick={e => {
//                             e.stopPropagation()
//                             handleEditLayout(layout)
//                           }}
//                         />
//                       </Tooltip>,
//                       <Tooltip title={layout.isDefault ? '기본 레이아웃' : '기본으로 설정'}>
//                         <Button
//                           key="setDefault"
//                           type="text"
//                           icon={layout.isDefault ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
//                           disabled={layout.isDefault}
//                           onClick={e => {
//                             e.stopPropagation()
//                             if (!layout.isDefault) {
//                               handleSetDefault(layout.id)
//                             }
//                           }}
//                         />
//                       </Tooltip>,
//                       <Popconfirm
//                         title="레이아웃 삭제"
//                         description="이 레이아웃을 삭제하시겠습니까?"
//                         onConfirm={e => {
//                           e?.stopPropagation()
//                           handleDeleteLayout(layout.id)
//                         }}
//                         okText="삭제"
//                         cancelText="취소"
//                       >
//                         <Button
//                           key="delete"
//                           type="text"
//                           danger
//                           icon={<DeleteOutlined />}
//                           onClick={e => e.stopPropagation()}
//                         />
//                       </Popconfirm>,
//                     ]}
//                   >
//                     <Card.Meta
//                       avatar={
//                         <Avatar
//                           shape="square"
//                           size="large"
//                           icon={<EyeOutlined />}
//                           style={{ backgroundColor: '#f56a00' }}
//                         />
//                       }
//                       title={
//                         <Space>
//                           {layout.name}
//                           {layout.isDefault && <Tag color="gold">기본</Tag>}
//                           {selectedLayoutId === layout.id && <Tag color="blue">선택됨</Tag>}
//                         </Space>
//                       }
//                       description={
//                         <div>
//                           <Text type="secondary" ellipsis>
//                             {layout.description || '설명 없음'}
//                           </Text>
//                           <br />
//                           <Text type="secondary" className="text-xs">
//                             요소 {layout.data.elements?.length || 0}개
//                           </Text>
//                         </div>
//                       }
//                     />
//                   </Card>
//                 </List.Item>
//               )}
//             />
//           )}
//         </Card>
//
//         <div className="mt-6 text-center">
//           <Button type="primary" htmlType="submit" loading={loading} size="large">
//             설정 저장
//           </Button>
//         </div>
//       </Form>
//
//       {/* 썸네일 에디터 다이얼로그 */}
//       <Modal
//         title={isCreatingNew ? '새 레이아웃 만들기' : '레이아웃 편집'}
//         open={editorVisible}
//         onCancel={handleEditorClose}
//         width="90%"
//         style={{ top: 20 }}
//         footer={null}
//         destroyOnHidden
//       >
//         <ThumbnailEditor
//           initialLayout={editingLayout?.data}
//           initialName={editingLayout?.name}
//           initialDescription={editingLayout?.description}
//           onSave={handleEditorSave}
//           onCancel={handleEditorClose}
//           isCreatingNew={isCreatingNew}
//         />
//       </Modal>
//
//       {/* 미리보기 모달 */}
//       <Modal
//         title="썸네일 미리보기"
//         open={previewVisible}
//         onCancel={() => setPreviewVisible(false)}
//         footer={[
//           <Button key="close" onClick={() => setPreviewVisible(false)}>
//             닫기
//           </Button>,
//         ]}
//         width={600}
//         centered
//       >
//         {previewImage && (
//           <div style={{ textAlign: 'center' }}>
//             <img
//               src={previewImage}
//               alt="썸네일 미리보기"
//               style={{
//                 maxWidth: '100%',
//                 maxHeight: '500px',
//                 borderRadius: '8px',
//                 border: '1px solid #f0f0f0',
//               }}
//             />
//           </div>
//         )}
//       </Modal>
//
//       <style
//         dangerouslySetInnerHTML={{
//           __html: `
//           .layout-card {
//             border: 2px solid transparent !important;
//             transition: all 0.3s;
//           }
//           .layout-card.selected {
//             border-color: #1890ff !important;
//             box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2) !important;
//           }
//           .layout-card:hover {
//             border-color: #40a9ff !important;
//           }
//         `,
//         }}
//       />
//     </div>
//   )
// }
